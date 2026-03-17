'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ─── Review Cycles ───────────────────────────────────────────────────────────

export function useReviewCycles(params?: { status?: string }) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['review-cycles', params],
    queryFn: () =>
      apiClient.get<{ data: any[] }>(`/api/performance/cycles?${searchParams.toString()}`),
  });
}

export function useReviewCycleDetail(id: string) {
  return useQuery({
    queryKey: ['review-cycle', id],
    queryFn: () => apiClient.get<{ data: any }>(`/api/performance/cycles/${id}`),
    enabled: !!id,
  });
}

export function useCreateReviewCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/performance/cycles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
    },
  });
}

export function useUpdateReviewCycle(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/api/performance/cycles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['review-cycle', id] });
    },
  });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function useMyReviews(params?: { cycleId?: string }) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['my-reviews', params],
    queryFn: () =>
      apiClient.get<{ data: any[] }>(`/api/performance/reviews?${searchParams.toString()}`),
  });
}

export function useReviewDetail(id: string) {
  return useQuery({
    queryKey: ['review', id],
    queryFn: () => apiClient.get<{ data: any }>(`/api/performance/reviews/${id}`),
    enabled: !!id,
  });
}

export function useSubmitReview(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/api/performance/reviews/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', id] });
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
    },
  });
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export function useGoals(params?: { employeeId?: string; status?: string; cycleId?: string }) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['goals', params],
    queryFn: () =>
      apiClient.get<{ data: any[] }>(`/api/performance/goals?${searchParams.toString()}`),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/performance/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateGoal(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/api/performance/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/performance/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
