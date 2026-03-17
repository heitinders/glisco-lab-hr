'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { LeaveRequestWithRelations, PaginatedLeaveResponse } from '@/types/leave';

interface LeaveFilters {
  page?: string;
  pageSize?: string;
  status?: string;
}

export function useLeaveRequests(params?: LeaveFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () =>
      apiClient.get<PaginatedLeaveResponse>(
        `/api/leave?${searchParams.toString()}`
      ),
  });
}

export function useLeaveRequest(id: string) {
  return useQuery({
    queryKey: ['leave-request', id],
    queryFn: () =>
      apiClient.get<LeaveRequestWithRelations>(`/api/leave/${id}`),
    enabled: !!id,
  });
}

export function useLeaveBalance(params?: { employeeId?: string; year?: string }) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['leave-balance', params],
    queryFn: () =>
      apiClient.get<{ data: unknown[]; year: number }>(
        `/api/leave/balance?${searchParams.toString()}`
      ),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/leave', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
  });
}

export function useApproveLeaveRequest(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { action: 'APPROVED' | 'REJECTED'; rejectedReason?: string }) =>
      apiClient.patch(`/api/leave/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-request', id] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
  });
}

export function useCancelLeaveRequest(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { reason: string }) =>
      apiClient.patch(`/api/leave/${id}`, { action: 'CANCELLED', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-request', id] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
  });
}
