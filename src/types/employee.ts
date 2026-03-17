import type { Prisma } from '@prisma/client';

/**
 * Employee with common relations loaded (department, designation, reporting manager).
 */
export type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: {
    department: true;
    designation: true;
    reportingTo: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        employeeId: true;
      };
    };
  };
}>;

/**
 * Employee with all relations loaded (for detail views).
 */
export type EmployeeDetail = Prisma.EmployeeGetPayload<{
  include: {
    department: true;
    designation: true;
    reportingTo: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        employeeId: true;
        profilePhotoUrl: true;
      };
    };
    directReports: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        employeeId: true;
        profilePhotoUrl: true;
      };
    };
    leaveBalances: {
      include: { leaveType: true };
    };
    documents: true;
    salaryHistory: true;
  };
}>;

/**
 * Lightweight employee reference for dropdowns and mentions.
 */
export type EmployeeRef = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhotoUrl: string | null;
};

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
