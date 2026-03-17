import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createLeaveRequestSchema } from '@/lib/validations/leave';
import { createAuditEntry } from '@/lib/audit';
import { notificationQueue } from '@/lib/queue';
import { eachDayOfInterval, isWeekend } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'leave:request');

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const status = searchParams.get('status') || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const filterEmployeeId = searchParams.get('employeeId') || undefined;

    const userRole = (session!.user as any).role;
    const employeeId = (session!.user as any).employeeId;
    const companyId = (session!.user as any).companyId;

    // Scope query based on role
    const where: any = {
      employee: { companyId },
      ...(status && { status }),
    };

    // Year filter
    if (year) {
      where.startDate = {
        gte: new Date(`${year}-01-01T00:00:00Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00Z`),
      };
    }

    // Role-based scoping
    if (['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole)) {
      // Admin/HR can filter by a specific employee
      if (filterEmployeeId) where.employeeId = filterEmployeeId;
    } else if (userRole === 'MANAGER') {
      // Managers see own + direct reports
      if (filterEmployeeId && filterEmployeeId !== employeeId) {
        // Only allow viewing a direct report
        where.employeeId = filterEmployeeId;
        where.employee.reportingToId = employeeId;
      } else {
        where.OR = [
          { employeeId },
          { employee: { reportingToId: employeeId } },
        ];
      }
    } else {
      where.employeeId = employeeId;
    }

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } },
          },
          leaveType: { select: { name: true, leaveType: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'desc' },
      }),
      db.leaveRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: requests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'leave:request');

    // 1. Validate request body
    const body = await req.json();
    const validated = createLeaveRequestSchema.parse(body);

    // 2. Extract session identifiers
    const employeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;

    // 3. Fetch employee record for region + manager
    const employee = await db.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        region: true,
        reportingToId: true,
        companyId: true,
      },
    });

    // 4. Fetch leave balance for the requested type + current year
    const currentYear = new Date().getFullYear();
    const balance = await db.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: validated.leaveTypeId,
          year: currentYear,
        },
      },
    });

    if (!balance) {
      return NextResponse.json(
        { error: 'No leave balance found for this leave type' },
        { status: 409 }
      );
    }

    // 5. Calculate business days
    const startDate = new Date(validated.startDate);
    const endDate = new Date(validated.endDate);

    let calculatedDays: number;

    if (validated.isHalfDay) {
      calculatedDays = 0.5;
    } else {
      // Fetch company holidays for the employee's region within the date range
      const holidays = await db.holiday.findMany({
        where: {
          companyId: employee.companyId,
          date: { gte: startDate, lte: endDate },
          isOptional: false,
          OR: [
            { region: employee.region },
            { region: null }, // Company-wide holidays
          ],
        },
        select: { date: true },
      });

      const holidayDates = new Set(
        holidays.map((h) => h.date.toISOString().split('T')[0])
      );

      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      calculatedDays = allDays.filter((day) => {
        if (isWeekend(day)) return false;
        const dateKey = day.toISOString().split('T')[0];
        if (holidayDates.has(dateKey)) return false;
        return true;
      }).length;
    }

    if (calculatedDays <= 0) {
      return NextResponse.json(
        { error: 'Selected dates contain no working days' },
        { status: 422 }
      );
    }

    // 6. Check sufficient balance: entitled + carried - used - pending >= requested
    const available =
      balance.entitled + balance.carried - balance.used - balance.pending;

    if (available < calculatedDays) {
      return NextResponse.json(
        {
          error: 'Insufficient leave balance',
          available,
          requested: calculatedDays,
        },
        { status: 409 }
      );
    }

    // 7. Create leave request + update pending balance + audit log in a transaction
    const created = await db.$transaction(async (tx) => {
      const leaveRequest = await tx.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId: validated.leaveTypeId,
          startDate,
          endDate,
          totalDays: calculatedDays,
          reason: validated.reason,
          status: 'PENDING',
          isHalfDay: validated.isHalfDay,
          halfDayType: validated.halfDayType ?? null,
          attachmentUrl: validated.attachmentUrl ?? null,
        },
      });

      await tx.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: validated.leaveTypeId,
            year: currentYear,
          },
        },
        data: {
          pending: { increment: calculatedDays },
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: employeeId,
          action: 'CREATE',
          resource: 'LeaveRequest',
          resourceId: leaveRequest.id,
          after: {
            leaveTypeId: validated.leaveTypeId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalDays: calculatedDays,
            status: 'PENDING',
            isHalfDay: validated.isHalfDay,
          },
        }),
      });

      return leaveRequest;
    });

    // 8. Queue notification to reporting manager (fire-and-forget, outside transaction)
    if (employee.reportingToId) {
      await notificationQueue.add('leave-request', {
        employeeId: employee.reportingToId,
        type: 'LEAVE_REQUEST_SUBMITTED',
        title: 'New Leave Request',
        body: `${employee.firstName} ${employee.lastName} has submitted a leave request for ${calculatedDays} day(s).`,
        link: `/leave/requests/${created.id}`,
      });
    }

    // 9. Return created leave request
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
