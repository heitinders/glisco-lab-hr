import { UserRole } from '@prisma/client';

export const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 100,
  HR_ADMIN: 90,
  HR_MANAGER: 80,
  FINANCE: 70,
  RECRUITER: 60,
  MANAGER: 50,
  EMPLOYEE: 10,
  VIEWER: 5,
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'HR Admin',
  HR_MANAGER: 'HR Manager',
  FINANCE: 'Finance',
  RECRUITER: 'Recruiter',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  VIEWER: 'Viewer',
};

export function isRoleAtLeast(userRole: string, minimumRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}
