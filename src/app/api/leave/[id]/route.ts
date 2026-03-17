import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { approveLeaveSchema } from '@/lib/validations/leave';
import { createAuditEntry } from '@/lib/audit';
import { notificationQueue } from '@/lib/queue';

// ---------------------------------------------------------------------------
// GET /api/leave/[id] — Fetch a single leave request
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'leave:request');

    const { id } = await params;

    const userRole = (session!.user as any).role;
    const employeeId = (session!.user as any).employeeId;

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            department: { select: { name: true } },
            reportingToId: true,
          },
        },
        leaveType: { select: { name: true, leaveType: true } },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 },
      );
    }

    // Ownership check: non-admin/HR roles can only view their own requests
    const isAdminOrHR = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole);
    if (!isAdminOrHR && leaveRequest.employeeId !== employeeId) {
      // Managers may view their direct reports' requests
      if (userRole === 'MANAGER' && leaveRequest.employee.reportingToId === employeeId) {
        // Allowed — manager viewing a direct report's request
      } else {
        return NextResponse.json(
          { error: 'You can only view your own leave requests' },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(leaveRequest);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/leave/[id] — Approve, Reject, or Cancel a leave request
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    const userRole = (session.user as any).role;
    const sessionEmployeeId: string = (session.user as any).employeeId;
    const companyId: string = (session.user as any).companyId;

    // Determine the action — support both approveLeaveSchema actions and CANCELLED
    const action: string | undefined = body?.action;

    if (action === 'CANCELLED') {
      return handleCancellation(id, sessionEmployeeId, companyId);
    }

    // Validate body against the approve/reject schema
    const parsed = approveLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { action: validatedAction, rejectedReason } = parsed.data;

    // ----- Permission check for APPROVED / REJECTED -----
    const canApproveAll = hasPermission(userRole, 'leave:approve_all');
    const canApproveTeam = hasPermission(userRole, 'leave:approve_team');

    if (!canApproveAll && !canApproveTeam) {
      return NextResponse.json(
        { error: 'Insufficient permissions to approve or reject leave' },
        { status: 403 },
      );
    }

    // Fetch the leave request
    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            reportingToId: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 },
      );
    }

    // Manager-only: verify the employee reports to this manager
    if (!canApproveAll && canApproveTeam) {
      if (leaveRequest.employee.reportingToId !== sessionEmployeeId) {
        return NextResponse.json(
          { error: 'You can only approve/reject leave for your direct reports' },
          { status: 403 },
        );
      }
    }

    // Ensure the request is still PENDING
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Already processed' },
        { status: 409 },
      );
    }

    // Derive the balance year from the leave request's start date
    const balanceYear = leaveRequest.startDate.getFullYear();

    // ----- Execute in a single transaction -----
    const updated = await db.$transaction(async (tx) => {
      let updatedRequest;

      if (validatedAction === 'APPROVED') {
        updatedRequest = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: sessionEmployeeId,
            approvedAt: new Date(),
          },
        });

        // Update leave balance: pending -> used
        await tx.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year: balanceYear,
            },
          },
          data: {
            pending: { decrement: leaveRequest.totalDays },
            used: { increment: leaveRequest.totalDays },
          },
        });
      } else {
        // REJECTED
        updatedRequest = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectedReason: rejectedReason ?? null,
          },
        });

        // Update leave balance: release pending days
        await tx.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year: balanceYear,
            },
          },
          data: {
            pending: { decrement: leaveRequest.totalDays },
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: sessionEmployeeId,
          action: validatedAction === 'APPROVED' ? 'APPROVE' : 'REJECT',
          resource: 'LeaveRequest',
          resourceId: id,
          after: {
            status: validatedAction,
            ...(rejectedReason && { rejectedReason }),
          },
        }),
      });

      return updatedRequest;
    });

    // Queue notification to the requesting employee (fire-and-forget)
    await notificationQueue.add('leave-decision', {
      employeeId: leaveRequest.employeeId,
      type: validatedAction === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      title: validatedAction === 'APPROVED' ? 'Leave Approved' : 'Leave Rejected',
      body:
        validatedAction === 'APPROVED'
          ? 'Your leave request has been approved.'
          : `Your leave request has been rejected.${rejectedReason ? ` Reason: ${rejectedReason}` : ''}`,
      link: `/leave/${id}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Self-cancellation helper
// ---------------------------------------------------------------------------

async function handleCancellation(
  leaveRequestId: string,
  sessionEmployeeId: string,
  companyId: string,
) {
  try {
    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: leaveRequestId },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 },
      );
    }

    // Only the requesting employee can cancel their own request
    if (leaveRequest.employeeId !== sessionEmployeeId) {
      return NextResponse.json(
        { error: 'You can only cancel your own leave requests' },
        { status: 403 },
      );
    }

    // Only PENDING requests can be cancelled
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be cancelled' },
        { status: 409 },
      );
    }

    const balanceYear = leaveRequest.startDate.getFullYear();

    const updated = await db.$transaction(async (tx) => {
      const updatedRequest = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: 'CANCELLED' },
      });

      // Release the pending days from the balance
      await tx.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: balanceYear,
          },
        },
        data: {
          pending: { decrement: leaveRequest.totalDays },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: sessionEmployeeId,
          action: 'UPDATE',
          resource: 'LeaveRequest',
          resourceId: leaveRequestId,
          after: { status: 'CANCELLED' },
        }),
      });

      return updatedRequest;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
