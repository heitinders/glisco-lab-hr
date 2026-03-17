import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/performance/goals/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'performance:review_self');

    const currentEmployeeId = (session!.user as any).employeeId as string;
    const role = (session!.user as any).role as string;

    const goal = await db.goal.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            reportingToId: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Access check
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role)) {
      const isOwner = goal.employeeId === currentEmployeeId;
      const isManager = goal.employee.reportingToId === currentEmployeeId;
      if (!isOwner && !isManager) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/performance/goals/[id] — Update goal progress/status
// ---------------------------------------------------------------------------

const updateGoalSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED', 'CANCELLED']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  keyResults: z
    .array(
      z.object({
        title: z.string().min(1),
        targetValue: z.number().positive(),
        currentValue: z.number().min(0),
        unit: z.string().max(50).default('%'),
      })
    )
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'performance:review_self');

    const body = await req.json();
    const validated = updateGoalSchema.parse(body);

    const currentEmployeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;
    const role = (session!.user as any).role as string;

    const existing = await db.goal.findUnique({
      where: { id },
      include: {
        employee: { select: { reportingToId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Access check: owner, manager, or HR+
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role)) {
      const isOwner = existing.employeeId === currentEmployeeId;
      const isManager = existing.employee.reportingToId === currentEmployeeId;
      if (!isOwner && !isManager) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Calculate progress from key results
    let progress = existing.progress;
    if (validated.keyResults && validated.keyResults.length > 0) {
      const totalCompletion = validated.keyResults.reduce((sum, kr) => {
        const pct = kr.targetValue > 0
          ? Math.min(100, (kr.currentValue / kr.targetValue) * 100)
          : 0;
        return sum + pct;
      }, 0);
      progress = Math.round(totalCompletion / validated.keyResults.length);
    }

    // Auto-update status based on progress
    let status = validated.status ?? existing.status;
    if (!validated.status && progress === 100) {
      status = 'COMPLETED';
    } else if (!validated.status && progress > 0 && status === 'NOT_STARTED') {
      status = 'IN_PROGRESS';
    }

    const goal = await db.$transaction(async (tx) => {
      const updated = await tx.goal.update({
        where: { id },
        data: {
          ...(validated.title && { title: validated.title }),
          ...(validated.description !== undefined && { description: validated.description }),
          ...(validated.dueDate !== undefined && { dueDate: validated.dueDate ? new Date(validated.dueDate) : null }),
          ...(validated.keyResults && { keyResults: validated.keyResults }),
          status,
          progress,
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
          action: 'UPDATE',
          resource: 'Goal',
          resourceId: id,
          before: { status: existing.status, progress: existing.progress },
          after: { status, progress },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return updated;
    });

    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/performance/goals/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'performance:review_self');

    const currentEmployeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;
    const role = (session!.user as any).role as string;

    const existing = await db.goal.findUnique({
      where: { id },
      select: { employeeId: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Only owner or HR+ can delete
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(role)) {
      if (existing.employeeId !== currentEmployeeId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.goal.delete({ where: { id } });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: currentEmployeeId,
          action: 'DELETE',
          resource: 'Goal',
          resourceId: id,
          before: { title: existing.title },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });
    });

    return NextResponse.json({ message: 'Goal deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
