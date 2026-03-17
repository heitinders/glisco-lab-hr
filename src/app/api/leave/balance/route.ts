import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'leave:request');

    const { searchParams } = new URL(req.url);
    const employeeId =
      searchParams.get('employeeId') || (session!.user as any).employeeId;
    const year = parseInt(
      searchParams.get('year') || new Date().getFullYear().toString()
    );

    // Non-admin users can only view their own balance
    const userRole = (session!.user as any).role;
    if (
      employeeId !== (session!.user as any).employeeId &&
      !['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole)
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // MANAGER can also view direct reports' balances
    if (
      employeeId !== (session!.user as any).employeeId &&
      userRole === 'MANAGER'
    ) {
      const report = await db.employee.findFirst({
        where: { id: employeeId, reportingToId: (session!.user as any).employeeId },
        select: { id: true },
      });
      if (!report) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    const balances = await db.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveType: {
          select: { id: true, name: true, leaveType: true, daysAllowed: true, isPaid: true, carryForward: true },
        },
      },
      orderBy: { leaveType: { name: 'asc' } },
    });

    // Compute derived fields
    const enriched = balances.map((b) => ({
      ...b,
      available: b.entitled + b.carried - b.used - b.pending,
      utilizationPercent: b.entitled > 0 ? Math.round((b.used / b.entitled) * 100) : 0,
    }));

    return NextResponse.json({ data: enriched, year });
  } catch (error) {
    return handleApiError(error);
  }
}
