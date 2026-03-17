import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/rbac/middleware';

const HR_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const companyId = user.companyId;
    const role = user.role;
    const employeeId = user.employeeId;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    if (HR_ROLES.includes(role) || role === 'FINANCE') {
      // HR/Admin/Finance dashboard
      const [
        totalEmployees,
        lastMonthEmployees,
        openPositions,
        pendingLeaves,
        onLeaveToday,
        hiresThisMonth,
        activeReviewCycles,
        headcountByDept,
      ] = await Promise.all([
        db.employee.count({ where: { companyId, status: 'ACTIVE' } }),
        db.employee.count({
          where: {
            companyId,
            status: 'ACTIVE',
            startDate: { lt: lastMonthEnd },
          },
        }),
        db.job.count({ where: { companyId, status: 'OPEN' } }),
        db.leaveRequest.count({
          where: {
            employee: { companyId },
            status: 'PENDING',
          },
        }),
        db.leaveRequest.count({
          where: {
            employee: { companyId },
            status: 'APPROVED',
            startDate: { lte: now },
            endDate: { gte: now },
          },
        }),
        db.employee.count({
          where: {
            companyId,
            status: 'ACTIVE',
            startDate: { gte: monthStart },
          },
        }),
        db.reviewCycle.count({ where: { companyId, isActive: true } }),
        db.employee.groupBy({
          by: ['departmentId'],
          where: { companyId, status: 'ACTIVE' },
          _count: true,
        }),
      ]);

      // Resolve department names
      const deptIds = headcountByDept
        .map((d) => d.departmentId)
        .filter(Boolean) as string[];
      const departments = deptIds.length > 0
        ? await db.department.findMany({
            where: { id: { in: deptIds } },
            select: { id: true, name: true },
          })
        : [];
      const deptMap = new Map(departments.map((d) => [d.id, d.name]));

      const employeeChange = totalEmployees - lastMonthEmployees;

      return NextResponse.json({
        role: 'hr',
        stats: {
          totalEmployees,
          employeeChange,
          openPositions,
          pendingLeaves,
          onLeaveToday,
          hiresThisMonth,
          activeReviewCycles,
        },
        charts: {
          headcountByDepartment: headcountByDept.map((d) => ({
            department: d.departmentId ? deptMap.get(d.departmentId) ?? 'Unknown' : 'Unassigned',
            count: d._count,
          })).sort((a, b) => b.count - a.count),
        },
      });
    }

    if (role === 'MANAGER') {
      // Manager dashboard
      const reportIds = (
        await db.employee.findMany({
          where: { managerId: employeeId, status: 'ACTIVE' },
          select: { id: true },
        })
      ).map((e) => e.id);

      const allIds = [employeeId, ...reportIds];

      const [teamSize, pendingLeaves, onLeaveToday, pendingReviews] = await Promise.all([
        reportIds.length,
        db.leaveRequest.count({
          where: {
            employeeId: { in: reportIds },
            status: 'PENDING',
          },
        }),
        db.leaveRequest.count({
          where: {
            employeeId: { in: allIds },
            status: 'APPROVED',
            startDate: { lte: now },
            endDate: { gte: now },
          },
        }),
        db.performanceReview.count({
          where: {
            reviewerId: employeeId,
            status: { notIn: ['COMPLETED', 'NOT_STARTED'] },
          },
        }),
      ]);

      return NextResponse.json({
        role: 'manager',
        stats: {
          teamSize,
          pendingLeaves,
          onLeaveToday,
          pendingReviews,
        },
      });
    }

    // Employee dashboard
    const [pendingReviews, leaveBalance, upcomingLeaves] = await Promise.all([
      db.performanceReview.count({
        where: {
          reviewerId: employeeId,
          status: { notIn: ['COMPLETED', 'NOT_STARTED'] },
        },
      }),
      db.leaveBalance.findMany({
        where: { employeeId },
        include: { leaveType: { select: { name: true } } },
      }),
      db.leaveRequest.count({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { gte: now },
        },
      }),
    ]);

    return NextResponse.json({
      role: 'employee',
      stats: {
        pendingReviews,
        upcomingLeaves,
        leaveBalance: leaveBalance.map((lb: any) => ({
          type: lb.leaveType?.name ?? 'Unknown',
          used: lb.used,
          total: lb.entitled,
          remaining: lb.entitled - lb.used,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
