'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface ReportColumn {
  key: string;
  label: string;
}

interface ReportResult {
  data: Record<string, unknown>[];
  columns: ReportColumn[];
  summary: Record<string, unknown>;
}

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  region?: string;
}

export function useReport(type: string, filters?: ReportFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(filters || {}).filter(
      ([, v]) => v != null && v !== ''
    ) as [string, string][]
  );

  const queryString = searchParams.toString();
  const url = `/api/reports/${type}${queryString ? `?${queryString}` : ''}`;

  return useQuery<ReportResult>({
    queryKey: ['report', type, filters],
    queryFn: () => apiClient.get<ReportResult>(url),
    enabled: !!type,
  });
}

export type { ReportResult, ReportColumn, ReportFilters };
