import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'attendance:view_own');

    const { searchParams } = new URL(req.url);
    const filterEmployeeId = searchParams.get('employeeId');
    const month = searchParams.get('month'); // YYYY-MM format
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to'); // YYYY-MM-DD
    const status = searchParams.get('status') || undefined;
    const team = searchParams.get('team'); // "true" for manager's team view
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '31'), 100);

    const userRole = (session!.user as any).role;
    const sessionEmployeeId = (session!.user as any).employeeId;
    const companyId = (session!.user as any).companyId;

    const where: any = {};

    // Role-based scoping
    if (['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole)) {
      // Admin/HR can view anyone in the company
      where.employee = { companyId };
      if (filterEmployeeId) where.employeeId = filterEmployeeId;
    } else if (userRole === 'MANAGER' && team === 'true') {
      // Manager team view
      where.employee = { companyId, reportingToId: sessionEmployeeId };
      if (filterEmployeeId) where.employeeId = filterEmployeeId;
    } else {
      // Default: own attendance only
      where.employeeId = filterEmployeeId || sessionEmployeeId;
      // Non-admin can't view others
      if (filterEmployeeId && filterEmployeeId !== sessionEmployeeId) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Date filtering
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      where.date = {
        gte: new Date(year, mon - 1, 1),
        lt: new Date(year, mon, 1),
      };
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    if (status) where.status = status;

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      db.attendance.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
