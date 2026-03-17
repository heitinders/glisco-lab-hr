'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface HRStats {
  role: 'hr';
  stats: {
    totalEmployees: number;
    employeeChange: number;
    openPositions: number;
    pendingLeaves: number;
    onLeaveToday: number;
    hiresThisMonth: number;
    activeReviewCycles: number;
  };
  charts: {
    headcountByDepartment: { department: string; count: number }[];
  };
}

interface ManagerStats {
  role: 'manager';
  stats: {
    teamSize: number;
    pendingLeaves: number;
    onLeaveToday: number;
    pendingReviews: number;
  };
}

interface EmployeeStats {
  role: 'employee';
  stats: {
    pendingReviews: number;
    upcomingLeaves: number;
    leaveBalance: { type: string; used: number; total: number; remaining: number }[];
  };
}

export type DashboardData = HRStats | ManagerStats | EmployeeStats;

export function useDashboardStats() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.get('/api/dashboard/stats'),
    refetchInterval: 60_000, // refresh every minute
  });
}
