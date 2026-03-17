import type { Prisma } from '@prisma/client';

/**
 * Payroll run with payslip count and details.
 */
export type PayrollRunWithPayslips = Prisma.PayrollRunGetPayload<{
  include: {
    payslips: {
      include: {
        employee: {
          select: {
            firstName: true;
            lastName: true;
            employeeId: true;
            department: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

/**
 * Payroll run summary (list view, without full payslip details).
 */
export type PayrollRunSummary = Prisma.PayrollRunGetPayload<{
  include: {
    _count: { select: { payslips: true } };
  };
}>;

/**
 * Individual payslip with employee info.
 */
export type PayslipWithEmployee = Prisma.PayslipGetPayload<{
  include: {
    employee: {
      select: {
        firstName: true;
        lastName: true;
        employeeId: true;
        region: true;
        department: { select: { name: true } };
      };
    };
  };
}>;

/**
 * Payroll allowance/deduction line item.
 */
export interface PayrollLineItem {
  name: string;
  amount: number;
  type: 'ALLOWANCE' | 'DEDUCTION';
  taxable?: boolean;
}

/**
 * Payroll run statistics for dashboard display.
 */
export interface PayrollStats {
  period: string;
  region: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  status: string;
  currency: string;
}
