'use server';

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { anthropic } from '@/lib/ai/client';
import { HR_ASSISTANT_SYSTEM } from '@/lib/ai/prompts';
import { db } from '@/lib/db';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    }),
  ).min(1).max(50),
});

// ---------------------------------------------------------------------------
// HR tool definitions for Claude
// ---------------------------------------------------------------------------

const HR_TOOLS: any[] = [
  {
    name: 'lookup_employee',
    description:
      'Look up employee information by name or email. Returns basic profile, department, designation, and employment status. Never returns sensitive fields like SSN or bank details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Employee name or email to search for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_leave_balances',
    description:
      'Check leave balances for an employee or department. Returns leave type, used, total, and remaining days.',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId: {
          type: 'string',
          description: 'Employee ID to check leave for (optional — omit for department-wide)',
        },
        department: {
          type: 'string',
          description: 'Department name to get aggregated leave data (optional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_whos_on_leave',
    description:
      'Get a list of employees who are on leave today or on a specific date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date to check (YYYY-MM-DD). Defaults to today.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_headcount_summary',
    description:
      'Get headcount summary by department, region, or overall. Returns counts of active employees.',
    input_schema: {
      type: 'object' as const,
      properties: {
        groupBy: {
          type: 'string',
          enum: ['department', 'region', 'designation'],
          description: 'How to group the headcount data',
        },
      },
      required: ['groupBy'],
    },
  },
  {
    name: 'draft_email',
    description:
      'Draft a professional HR email for a given purpose. Returns the subject and body text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        purpose: {
          type: 'string',
          description: 'Purpose of the email (e.g., "offer letter", "performance improvement plan", "welcome email")',
        },
        recipientName: {
          type: 'string',
          description: 'Name of the recipient',
        },
        details: {
          type: 'string',
          description: 'Additional details to include',
        },
      },
      required: ['purpose'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  companyId: string,
  userRole: string,
): Promise<string> {
  switch (toolName) {
    case 'lookup_employee': {
      const query = toolInput.query as string;
      const employees = await db.employee.findMany({
        where: {
          companyId,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          region: true,
          employmentStatus: true,
          dateOfJoining: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
          reportingTo: { select: { firstName: true, lastName: true } },
        },
        take: 5,
      });

      if (employees.length === 0) return 'No employees found matching that query.';

      return employees
        .map(
          (e) =>
            `${e.firstName} ${e.lastName} (${e.email}) — ${e.designation?.title || 'N/A'}, ${e.department?.name || 'N/A'} | Region: ${e.region} | Status: ${e.employmentStatus} | Joined: ${e.dateOfJoining?.toISOString().split('T')[0] || 'N/A'} | Reports to: ${e.reportingTo ? `${e.reportingTo.firstName} ${e.reportingTo.lastName}` : 'N/A'}`,
        )
        .join('\n');
    }

    case 'check_leave_balances': {
      const { employeeId, department } = toolInput;

      const where: any = { companyId };
      if (employeeId) {
        where.employeeId = employeeId;
      } else if (department) {
        where.employee = {
          department: { name: { equals: department, mode: 'insensitive' } },
        };
      }

      const balances = await db.leaveBalance.findMany({
        where: {
          ...where,
          year: new Date().getFullYear(),
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          leaveType: { select: { name: true } },
        },
        take: 50,
      });

      if (balances.length === 0) return 'No leave balance records found.';

      return balances
        .map(
          (b) =>
            `${b.employee.firstName} ${b.employee.lastName} — ${b.leaveType.name}: ${b.used}/${b.total} used (${b.total - b.used} remaining)`,
        )
        .join('\n');
    }

    case 'get_whos_on_leave': {
      const date = toolInput.date
        ? new Date(toolInput.date)
        : new Date();
      const dateStr = date.toISOString().split('T')[0];

      const leaves = await db.leaveRequest.findMany({
        where: {
          employee: { companyId },
          status: 'APPROVED',
          startDate: { lte: date },
          endDate: { gte: date },
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { name: true } },
        },
      });

      if (leaves.length === 0) return `No one is on leave on ${dateStr}.`;

      return (
        `Employees on leave on ${dateStr}:\n` +
        leaves
          .map(
            (l) =>
              `- ${l.employee.firstName} ${l.employee.lastName} (${l.employee.department?.name || 'N/A'}) — ${l.leaveType.name} (${l.startDate.toISOString().split('T')[0]} to ${l.endDate.toISOString().split('T')[0]})`,
          )
          .join('\n')
      );
    }

    case 'get_headcount_summary': {
      const groupBy = toolInput.groupBy as string;

      if (groupBy === 'department') {
        const depts = await db.department.findMany({
          where: { companyId },
          include: {
            _count: {
              select: {
                employees: { where: { employmentStatus: 'ACTIVE' } },
              },
            },
          },
        });
        return depts
          .map((d) => `${d.name}: ${d._count.employees} active employees`)
          .join('\n');
      }

      if (groupBy === 'region') {
        const regions = await db.employee.groupBy({
          by: ['region'],
          where: { companyId, employmentStatus: 'ACTIVE' },
          _count: true,
        });
        return regions
          .map((r) => `${r.region}: ${r._count} active employees`)
          .join('\n');
      }

      if (groupBy === 'designation') {
        const desigs = await db.employee.groupBy({
          by: ['designationId'],
          where: { companyId, employmentStatus: 'ACTIVE' },
          _count: true,
        });
        const designations = await db.designation.findMany({
          where: { id: { in: desigs.map((d) => d.designationId).filter(Boolean) as string[] } },
          select: { id: true, title: true },
        });
        const nameMap = new Map(designations.map((d) => [d.id, d.title]));
        return desigs
          .map(
            (d) =>
              `${d.designationId ? nameMap.get(d.designationId) || 'Unknown' : 'Unassigned'}: ${d._count} active employees`,
          )
          .join('\n');
      }

      return 'Invalid groupBy parameter. Use: department, region, or designation.';
    }

    case 'draft_email': {
      // For email drafting, we just return a note that the AI should compose it inline
      return `Please compose this email directly in your response. Purpose: ${toolInput.purpose}. Recipient: ${toolInput.recipientName || 'Not specified'}. Details: ${toolInput.details || 'None provided'}.`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ---------------------------------------------------------------------------
// GET — capabilities endpoint (unchanged)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'ai:assistant');

    return Response.json({
      capabilities: [
        'lookup_employee',
        'check_leave_balances',
        'get_whos_on_leave',
        'get_headcount_summary',
        'draft_email',
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST — streaming chat with tool use
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'ai:assistant');

    const body = await req.json();
    const { messages } = chatSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const userRole = (session!.user as any).role as string;
    const userEmail = session!.user?.email || 'unknown';

    // Fetch company name for context
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true, regions: true },
    });

    // Build system prompt with user context
    const systemPrompt = `${HR_ASSISTANT_SYSTEM}

Current user: ${userEmail} (Role: ${userRole})
Company: ${company?.name || 'Unknown'}
Regions: ${(company?.regions || []).join(', ')}
Date: ${new Date().toISOString().split('T')[0]}

IMPORTANT SECURITY RULES:
- Never reveal SSN, Aadhaar, PAN, bank account details, or other PII through tool results
- Only show data the user's role (${userRole}) would normally have access to
- For MANAGER role: only show data about direct reports
- Be transparent when you cannot access certain data due to permissions`;

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initial Claude call with tools
          let currentMessages: any[] = [...anthropicMessages];
          let iteration = 0;
          const MAX_TOOL_ITERATIONS = 5;

          while (iteration < MAX_TOOL_ITERATIONS) {
            iteration++;

            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 2048,
              system: systemPrompt,
              messages: currentMessages,
              tools: HR_TOOLS,
            });

            // Check if we have tool use blocks
            const toolUseBlocks = response.content.filter(
              (block) => block.type === 'tool_use',
            );
            const textBlocks = response.content.filter(
              (block) => block.type === 'text',
            );

            // Send any text blocks first
            for (const block of textBlocks) {
              if (block.type === 'text' && block.text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`),
                );
              }
            }

            // If no tool use, we're done
            if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
              );
              break;
            }

            // Execute tools
            const toolResults: any[] = [];
            for (const block of toolUseBlocks) {
              if (block.type === 'tool_use') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'tool_call', tool: block.name })}\n\n`,
                  ),
                );

                const result = await executeTool(
                  block.name,
                  block.input as Record<string, any>,
                  companyId,
                  userRole,
                );

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                });
              }
            }

            // Add assistant response + tool results to messages for next iteration
            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
              ...toolResults.map((tr) => ({
                role: 'user' as const,
                content: [tr],
              })),
            ];
          }
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', content: err?.message || 'AI assistant error' })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
