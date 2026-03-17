import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/performance/goals — List goals
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'performance:review_self');

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId') || undefined;
    const status = searchParams.get('status') || undefined;
    const cycleId = searchParams.get('cycleId') || undefined;

    const currentEmployeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;
    const role = (session!.user as any).role as string;

    const where: any = {};

    // Scope based on role
    if (['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role)) {
      // HR+ can view all goals for the company
      where.employee = { companyId };
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else if (role === 'MANAGER') {
      // Managers can see own + direct reports
      if (employeeId && employeeId !== currentEmployeeId) {
        // Verify they are the manager of this employee
        const report = await db.employee.findFirst({
          where: { id: employeeId, reportingToId: currentEmployeeId },
          select: { id: true },
        });
        if (!report) {
          return NextResponse.json({ error: 'Not authorized to view this employee\'s goals' }, { status: 403 });
        }
        where.employeeId = employeeId;
      } else if (!employeeId) {
        // Return own + direct reports' goals
        where.OR = [
          { employeeId: currentEmployeeId },
          { employee: { reportingToId: currentEmployeeId } },
        ];
      } else {
        where.employeeId = currentEmployeeId;
      }
    } else {
      // Regular employee: own goals only
      where.employeeId = currentEmployeeId;
    }

    if (status) where.status = status;
    if (cycleId) where.cycleId = cycleId;

    const goals = await db.goal.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: goals });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/performance/goals — Create a goal
// ---------------------------------------------------------------------------

const createGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  cycleId: z.string().optional(),
  employeeId: z.string().optional(),
  keyResults: z
    .array(
      z.object({
        title: z.string().min(1),
        targetValue: z.number().positive(),
        currentValue: z.number().min(0).default(0),
        unit: z.string().max(50).default('%'),
      })
    )
    .default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'performance:review_self');

    const body = await req.json();
    const validated = createGoalSchema.parse(body);

    const currentEmployeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;
    const role = (session!.user as any).role as string;

    // Determine the target employee
    let targetEmployeeId = currentEmployeeId;

    if (validated.employeeId && validated.employeeId !== currentEmployeeId) {
      // Creating a goal for another employee — must be manager or HR+
      if (['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role)) {
        targetEmployeeId = validated.employeeId;
      } else if (role === 'MANAGER') {
        const report = await db.employee.findFirst({
          where: { id: validated.employeeId, reportingToId: currentEmployeeId },
          select: { id: true },
        });
        if (!report) {
          return NextResponse.json(
            { error: 'You can only create goals for your direct reports' },
            { status: 403 }
          );
        }
        targetEmployeeId = validated.employeeId;
      } else {
        return NextResponse.json(
          { error: 'You can only create goals for yourself' },
          { status: 403 }
        );
      }
    }

    const goal = await db.$transaction(async (tx) => {
      const created = await tx.goal.create({
        data: {
          employeeId: targetEmployeeId,
          title: validated.title,
          description: validated.description ?? null,
          dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
          cycleId: validated.cycleId ?? null,
          keyResults: validated.keyResults,
          status: 'NOT_STARTED',
          progress: 0,
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: currentEmployeeId,
          action: 'CREATE',
          resource: 'Goal',
          resourceId: created.id,
          after: {
            title: validated.title,
            employeeId: targetEmployeeId,
            keyResults: validated.keyResults.length,
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return created;
    });

    return NextResponse.json({ data: goal }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
