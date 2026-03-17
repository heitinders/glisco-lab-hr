import type { Prisma } from '@prisma/client';

/**
 * Leave request with employee name, department, and leave type details.
 */
export type LeaveRequestWithRelations = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: {
      select: {
        firstName: true;
        lastName: true;
        employeeId: true;
        department: { select: { name: true } };
      };
    };
    leaveType: {
      select: {
        name: true;
        leaveType: true;
      };
    };
  };
}>;

/**
 * Leave balance with leave type config details.
 */
export type LeaveBalanceWithType = Prisma.LeaveBalanceGetPayload<{
  include: {
    leaveType: {
      select: {
        name: true;
        leaveType: true;
        daysAllowed: true;
      };
    };
  };
}>;

/**
 * Summary of leave balance for display in dashboards.
 */
export interface LeaveBalanceSummary {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  entitled: number;
  used: number;
  pending: number;
  carried: number;
  available: number;
}

/**
 * Paginated leave response type.
 */
export interface PaginatedLeaveResponse {
  data: LeaveRequestWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
