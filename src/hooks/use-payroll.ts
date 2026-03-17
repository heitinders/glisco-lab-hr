'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface PayrollRunFilters {
  page?: string;
  pageSize?: string;
  status?: string;
  region?: string;
  year?: string;
}

interface PayrollRunSummary {
  id: string;
  companyId: string;
  period: string;
  region: string;
  status: string;
  currency: string;
  totalGross: string | number;
  totalNet: string | number;
  totalTax: string | number;
  processedAt: string | null;
  approvedById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { payslips: number };
}

interface PaginatedPayrollResponse {
  data: PayrollRunSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PayrollRunDetail extends PayrollRunSummary {
  payslips: PayslipRecord[];
}

interface PayslipRecord {
  id: string;
  payrollRunId: string;
  employeeId: string;
  period: string;
  currency: string;
  basicSalary: string | number;
  hra: string | number | null;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossPay: string | number;
  taxDeducted: string | number;
  stateTax: string | number | null;
  pf: string | number | null;
  esi: string | number | null;
  netPay: string | number;
  leaveDays: number;
  overtimePay: string | number | null;
  bonuses: string | number | null;
  pdfUrl: string | null;
  paidAt: string | null;
  employee?: {
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: { name: string } | null;
  };
}

export function usePayrollRuns(params?: PayrollRunFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['payroll-runs', params],
    queryFn: () =>
      apiClient.get<PaginatedPayrollResponse>(
        `/api/payroll?${searchParams.toString()}`
      ),
  });
}

export function usePayrollRunDetail(id: string) {
  return useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () =>
      apiClient.get<{ data: PayrollRunDetail }>(
        `/api/payroll/run?id=${id}`
      ),
    enabled: !!id,
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { month: number; year: number; region: string; notes?: string }) =>
      apiClient.post<{ data: PayrollRunSummary }>('/api/payroll/run', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
  });
}

export function useUpdatePayrollRunStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { runId: string; action: 'PROCESS' | 'APPROVE' | 'REJECT' | 'PAY' }) =>
      apiClient.patch<{ data: PayrollRunSummary }>('/api/payroll/run', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run', variables.runId] });
    },
  });
}

export function useEmployeePayslips(employeeId: string) {
  return useQuery({
    queryKey: ['payslips', employeeId],
    queryFn: () =>
      apiClient.get<{ data: PayslipRecord[] }>(
        `/api/payroll?employeeId=${employeeId}`
      ),
    enabled: !!employeeId,
  });
}

export type {
  PayrollRunSummary,
  PayrollRunDetail,
  PayslipRecord,
  PaginatedPayrollResponse,
};
