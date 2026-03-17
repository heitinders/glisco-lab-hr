'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import {
  hasPermission,
  getPermissionsForRole,
  type Permission,
} from '@/lib/rbac/permissions';
import { isRoleAtLeast } from '@/lib/rbac/roles';

/**
 * Hook to check if the current user has a specific permission.
 *
 * @example
 * ```tsx
 * const { can, canAny, canAll, role } = usePermission();
 *
 * if (can('employee:create')) {
 *   // Render create button
 * }
 *
 * if (canAny(['leave:approve_team', 'leave:approve_all'])) {
 *   // Render approval panel
 * }
 * ```
 */
export function usePermission() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string | undefined;

  const permissions = useMemo(() => {
    if (!role) return [] as Permission[];
    return getPermissionsForRole(role);
  }, [role]);

  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!role) return false;
      return hasPermission(role, permission);
    };
  }, [role]);

  const canAny = useMemo(() => {
    return (permissionList: Permission[]): boolean => {
      if (!role) return false;
      return permissionList.some((p) => hasPermission(role, p));
    };
  }, [role]);

  const canAll = useMemo(() => {
    return (permissionList: Permission[]): boolean => {
      if (!role) return false;
      return permissionList.every((p) => hasPermission(role, p));
    };
  }, [role]);

  const isAtLeast = useMemo(() => {
    return (minimumRole: string): boolean => {
      if (!role) return false;
      return isRoleAtLeast(role, minimumRole);
    };
  }, [role]);

  return {
    /** The current user's role */
    role,
    /** All permissions the current user has */
    permissions,
    /** Check if user has a specific permission */
    can,
    /** Check if user has any of the listed permissions */
    canAny,
    /** Check if user has all of the listed permissions */
    canAll,
    /** Check if user's role is at or above a minimum role level */
    isAtLeast,
    /** Whether the session is loaded */
    isLoaded: !!session,
  };
}
