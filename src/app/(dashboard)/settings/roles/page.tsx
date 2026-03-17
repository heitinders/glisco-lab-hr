'use client';

import { useState, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsers, useUpdateUserRole, type UserListItem } from '@/hooks/use-settings';
import { usePermission } from '@/hooks/use-permissions';
import { ROLE_LABELS } from '@/lib/rbac/roles';

// ---------------------------------------------------------------------------
// Role badge variant mapping
// ---------------------------------------------------------------------------

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  SUPER_ADMIN: 'destructive',
  HR_ADMIN: 'default',
  HR_MANAGER: 'secondary',
  MANAGER: 'secondary',
  FINANCE: 'warning',
  RECRUITER: 'outline',
  EMPLOYEE: 'outline',
  VIEWER: 'outline',
};

const ALL_ROLES = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HR_MANAGER',
  'MANAGER',
  'EMPLOYEE',
  'RECRUITER',
  'FINANCE',
  'VIEWER',
] as const;

// ---------------------------------------------------------------------------
// Role change cell component
// ---------------------------------------------------------------------------

function RoleCell({
  user,
  isSuperAdmin,
}: {
  user: UserListItem;
  isSuperAdmin: boolean;
}) {
  const mutation = useUpdateUserRole(user.id);

  const handleRoleChange = useCallback(
    (newRole: string) => {
      if (newRole === user.role) return;

      mutation.mutate(
        { role: newRole },
        {
          onSuccess: () => {
            toast.success(
              `Role updated to ${ROLE_LABELS[newRole] || newRole} for ${user.email}`,
            );
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to update role');
          },
        },
      );
    },
    [mutation, user.role, user.email],
  );

  if (!isSuperAdmin) {
    return (
      <Badge variant={ROLE_BADGE_VARIANT[user.role] || 'outline'}>
        {ROLE_LABELS[user.role] || user.role}
      </Badge>
    );
  }

  return (
    <Select
      value={user.role}
      onValueChange={handleRoleChange}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-8 w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role] || role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function getColumns(isSuperAdmin: boolean): ColumnDef<UserListItem, any>[] {
  return [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.email}</span>
      ),
    },
    {
      id: 'employeeName',
      header: 'Employee Name',
      accessorFn: (row) =>
        row.employee
          ? `${row.employee.firstName} ${row.employee.lastName}`
          : null,
      cell: ({ row }) => {
        const emp = row.original.employee;
        if (!emp) {
          return (
            <span className="text-muted-foreground italic">Not linked</span>
          );
        }
        return `${emp.firstName} ${emp.lastName}`;
      },
    },
    {
      accessorKey: 'role',
      header: 'Current Role',
      cell: ({ row }) => (
        <RoleCell user={row.original} isSuperAdmin={isSuperAdmin} />
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last Login',
      cell: ({ row }) => {
        const date = row.original.lastLoginAt;
        if (!date) {
          return <span className="text-muted-foreground">Never</span>;
        }
        return format(new Date(date), 'MMM d, yyyy HH:mm');
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPermissionsPage() {
  const [page, setPage] = useState('1');
  const { data, isLoading, isError } = useUsers({ page, pageSize: '50' });
  const { role, can } = usePermission();

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const columns = getColumns(isSuperAdmin);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-[#4B9EFF]" />
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Roles &amp; Permissions
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage user roles and their associated permissions. Only Super Admins
          can modify role assignments.
        </p>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {data.total} user{data.total !== 1 ? 's' : ''} in your organization
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load users. Please try again.
        </div>
      )}

      {/* Data table */}
      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchKey="email"
          searchPlaceholder="Search by email..."
          emptyMessage="No users found."
        />
      )}
    </div>
  );
}
