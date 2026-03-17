'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface AttendanceFilters {
  employeeId?: string;
  month?: string; // YYYY-MM format
  page?: string;
  pageSize?: string;
}

interface ClockStatus {
  data: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    hoursWorked: number | null;
    status: string;
  } | null;
  isClockedIn: boolean;
}

export function useAttendance(params?: AttendanceFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () =>
      apiClient.get<{
        data: unknown[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/api/attendance?${searchParams.toString()}`),
  });
}

export function useClockStatus() {
  return useQuery({
    queryKey: ['clock-status'],
    queryFn: () => apiClient.get<ClockStatus>('/api/attendance/clock'),
    refetchInterval: 60_000, // Refresh every minute
  });
}

export function useClockInOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: 'clock_in' | 'clock_out') =>
      apiClient.post('/api/attendance/clock', { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
