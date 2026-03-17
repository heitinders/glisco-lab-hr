import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/departments — List all departments for the company
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const companyId = (session!.user as any).companyId as string;

    const departments = await db.department.findMany({
      where: { companyId },
      include: {
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        },
        parent: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: departments });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/departments — Create a new department
// ---------------------------------------------------------------------------

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(50),
  headId: z.string().optional(),
  parentId: z.string().optional(),
  budget: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const body = await req.json();
    const validated = createDepartmentSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    try {
      const department = await db.$transaction(async (tx) => {
        const created = await tx.department.create({
          data: {
            companyId,
            name: validated.name,
            code: validated.code,
            headId: validated.headId ?? null,
            parentId: validated.parentId ?? null,
            budget: validated.budget ?? null,
          },
          include: {
            head: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true,
              },
            },
            parent: {
              select: { id: true, name: true, code: true },
            },
          },
        });

        await tx.auditLog.create({
          data: createAuditEntry({
            companyId,
            actorId,
            action: 'CREATE',
            resource: 'Department',
            resourceId: created.id,
            after: {
              name: validated.name,
              code: validated.code,
              headId: validated.headId ?? null,
              parentId: validated.parentId ?? null,
              budget: validated.budget ?? null,
            },
            ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
            userAgent: req.headers.get('user-agent'),
          }),
        });

        return created;
      });

      return NextResponse.json({ data: department }, { status: 201 });
    } catch (txError: any) {
      if (txError?.code === 'P2002') {
        return NextResponse.json(
          { error: 'A department with this code already exists' },
          { status: 409 }
        );
      }
      throw txError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
