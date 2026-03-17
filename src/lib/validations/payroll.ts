import { z } from 'zod';

export const runPayrollSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format'),
  region: z.enum(['US', 'INDIA', 'REMOTE']),
  notes: z.string().max(1000).optional().nullable(),
});

export const approvePayrollSchema = z.object({
  payrollRunId: z.string().cuid('Invalid payroll run ID'),
  action: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(1000).optional().nullable(),
});

export const adjustPayslipSchema = z.object({
  payslipId: z.string().cuid('Invalid payslip ID'),
  adjustments: z.array(
    z.object({
      type: z.enum(['ALLOWANCE', 'DEDUCTION', 'BONUS', 'OVERTIME']),
      name: z.string().min(1, 'Adjustment name is required').max(100),
      amount: z.number().min(0, 'Amount must be positive'),
      reason: z.string().max(500).optional(),
    })
  ),
});

export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
export type ApprovePayrollInput = z.infer<typeof approvePayrollSchema>;
export type AdjustPayslipInput = z.infer<typeof adjustPayslipSchema>;
