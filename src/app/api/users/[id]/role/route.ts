import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { withAudit } from '@/lib/audit';

const VALID_ROLES = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HR_MANAGER',
  'MANAGER',
  'EMPLOYEE',
  'RECRUITER',
  'FINANCE',
  'VIEWER',
] as const;

const updateRoleSchema = z.object({
  role: z.enum(VALID_ROLES),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'users:manage_roles');

    const { id: targetUserId } = await params;
    const body = await req.json();
    const { role: newRole } = updateRoleSchema.parse(body);

    const currentUserId = (session!.user as any).id as string;
    const companyId = (session!.user as any).companyId as string;

    // Cannot demote yourself
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 422 },
      );
    }

    // Fetch the target user
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    // Ensure same company
    if (targetUser.companyId !== companyId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    // Cannot demote the last SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const superAdminCount = await db.user.count({
        where: {
          companyId,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last Super Admin. Promote another user first.' },
          { status: 422 },
        );
      }
    }

    // No-op if role is the same
    if (targetUser.role === newRole) {
      return NextResponse.json({ data: targetUser });
    }

    const oldRecord = { role: targetUser.role };
    const newRecord = { role: newRole };

    const auditParams = {
      companyId,
      actorId: currentUserId,
      action: 'UPDATE' as const,
      resource: 'User',
      resourceId: targetUserId,
      before: oldRecord,
      after: newRecord,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      userAgent: req.headers.get('user-agent') || null,
    };

    const updatedUser = await withAudit(auditParams, async (tx) => {
      return tx.user.update({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        data: { role: newRole },
      });
    });

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    return handleApiError(error);
  }
}
