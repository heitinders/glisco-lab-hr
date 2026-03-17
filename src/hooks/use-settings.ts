'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserListItem {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AuditLogEntry {
  id: string;
  companyId: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    role: string;
  } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface UserFilters {
  page?: string;
  pageSize?: string;
  search?: string;
  role?: string;
  isActive?: string;
}

interface AuditLogFilters {
  page?: string;
  pageSize?: string;
  action?: string;
  resource?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useUsers(filters?: UserFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(filters || {}).filter(([, v]) => v != null && v !== '') as [
      string,
      string,
    ][],
  );

  return useQuery({
    queryKey: ['users', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<UserListItem>>(
        `/api/users?${searchParams.toString()}`,
      ),
  });
}

export function useUpdateUserRole(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { role: string }) =>
      apiClient.patch<{ data: UserListItem }>(
        `/api/users/${userId}/role`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAuditLog(filters?: AuditLogFilters) {
  const searchParams = new URLSearchParams(
    Object.entries(filters || {}).filter(([, v]) => v != null && v !== '') as [
      string,
      string,
    ][],
  );

  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AuditLogEntry>>(
        `/api/audit-log?${searchParams.toString()}`,
      ),
  });
}
