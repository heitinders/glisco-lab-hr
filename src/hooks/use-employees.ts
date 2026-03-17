'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { EmployeeWithRelations, PaginatedResponse } from '@/types/employee';

interface EmployeeFilters {
  page?: string;
  pageSize?: string;
  search?: string;
  department?: string;
  status?: string;
}

export function useEmployees(params?: EmployeeFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
  );

  return useQuery({
    queryKey: ['employees', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<EmployeeWithRelations>>(
        `/api/employees?${searchParams.toString()}`
      ),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () =>
      apiClient.get<EmployeeWithRelations>(`/api/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    },
  });
}

export function useEmployeeDocuments(employeeId: string) {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () =>
      apiClient.get<{ data: unknown[] }>(
        `/api/employees/${employeeId}/documents`
      ),
    enabled: !!employeeId,
  });
}
