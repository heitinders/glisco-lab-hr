import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry, buildChanges } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/departments/[id] — Single department with employees, head, parent
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const companyId = (session!.user as any).companyId as string;

    const department = await db.department.findUnique({
      where: { id },
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
        children: {
          select: { id: true, name: true, code: true },
        },
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: {
              select: { id: true, title: true, level: true },
            },
            status: true,
          },
          orderBy: { firstName: 'asc' },
        },
      },
    });

    if (!department || department.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: department });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/departments/[id] — Update department
// ---------------------------------------------------------------------------

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  headId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const body = await req.json();
    const validated = updateDepartmentSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    // Verify department exists and belongs to this company
    const existing = await db.department.findUnique({ where: { id } });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Prevent circular parent reference
    if (validated.parentId === id) {
      return NextResponse.json(
        { error: 'A department cannot be its own parent' },
        { status: 422 }
      );
    }

    try {
      const updated = await db.$transaction(async (tx) => {
        const dept = await tx.department.update({
          where: { id },
          data: {
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.headId !== undefined && { headId: validated.headId }),
            ...(validated.parentId !== undefined && { parentId: validated.parentId }),
            ...(validated.budget !== undefined && { budget: validated.budget }),
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

        const changes = buildChanges(
          existing as unknown as Record<string, unknown>,
          validated as Record<string, unknown>,
        );

        await tx.auditLog.create({
          data: createAuditEntry({
            companyId,
            actorId,
            action: 'UPDATE',
            resource: 'Department',
            resourceId: id,
            before: changes,
            after: null,
            ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
            userAgent: req.headers.get('user-agent'),
          }),
        });

        return dept;
      });

      return NextResponse.json({ data: updated });
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

// ---------------------------------------------------------------------------
// DELETE /api/departments/[id] — Delete department (only if no employees)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    const existing = await db.department.findUnique({
      where: { id },
      include: {
        _count: { select: { employees: true } },
      },
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete department with assigned employees',
          employeeCount: existing._count.employees,
        },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'DELETE',
          resource: 'Department',
          resourceId: id,
          before: {
            name: existing.name,
            code: existing.code,
            headId: existing.headId,
            parentId: existing.parentId,
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });
    });

    return NextResponse.json({ message: 'Department deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
