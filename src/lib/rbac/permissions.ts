export const PERMISSIONS = {
  // Employee
  'employee:read': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'VIEWER'],
  'employee:read_sensitive': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'employee:create': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'employee:update': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'employee:update_own': ['EMPLOYEE', 'MANAGER'],
  'employee:delete': ['SUPER_ADMIN', 'HR_ADMIN'],
  'employee:export': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  // Leave
  'leave:request': ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'HR_MANAGER'],
  'leave:approve_team': ['MANAGER'],
  'leave:approve_all': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'leave:view_team': ['MANAGER'],
  'leave:view_all': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'FINANCE', 'VIEWER'],
  'leave:manage_policy': ['SUPER_ADMIN', 'HR_ADMIN'],
  // Attendance
  'attendance:view_own': ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'HR_MANAGER'],
  'attendance:view_team': ['MANAGER'],
  'attendance:view_all': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'FINANCE'],
  'attendance:edit': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  // Payroll
  'payroll:view_own': ['EMPLOYEE'],
  'payroll:view_all': ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'],
  'payroll:run': ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'],
  'payroll:approve': ['SUPER_ADMIN'],
  // Performance
  'performance:review_self': ['EMPLOYEE'],
  'performance:review_peer': ['EMPLOYEE', 'MANAGER'],
  'performance:review_team': ['MANAGER'],
  'performance:view_all': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'performance:manage_cycles': ['SUPER_ADMIN', 'HR_ADMIN'],
  // Recruitment
  'recruitment:view': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'],
  'recruitment:manage': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'RECRUITER'],
  // Documents
  'documents:view_own': ['EMPLOYEE', 'MANAGER'],
  'documents:view_all': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'documents:upload': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
  'documents:manage': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'],
  'documents:delete': ['SUPER_ADMIN', 'HR_ADMIN'],
  // Settings
  'settings:view': ['SUPER_ADMIN', 'HR_ADMIN'],
  'settings:manage': ['SUPER_ADMIN'],
  'settings:roles': ['SUPER_ADMIN'],
  // Reports
  'reports:view': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'FINANCE'],
  'reports:basic': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'FINANCE'],
  'reports:advanced': ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'],
  // Audit
  'audit:view': ['SUPER_ADMIN', 'HR_ADMIN'],
  // Users
  'users:list': ['SUPER_ADMIN', 'HR_ADMIN'],
  'users:manage_roles': ['SUPER_ADMIN'],
  // AI
  'ai:assistant': ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(userRole: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(userRole);
}

export function requiresOwnership(permission: Permission): boolean {
  return permission.endsWith('_own') || permission.endsWith('_team');
}

export function getPermissionsForRole(role: string): Permission[] {
  return (Object.entries(PERMISSIONS) as [Permission, readonly string[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}
