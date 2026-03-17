'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, Pencil } from 'lucide-react';
import { useEmployees } from '@/hooks/use-employees';
import { usePermission } from '@/hooks/use-permissions';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmployeeWithRelations } from '@/types/employee';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  ON_LEAVE: { label: 'On Leave', variant: 'warning' },
  NOTICE_PERIOD: { label: 'Notice Period', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'destructive' },
  OFFBOARDED: { label: 'Offboarded', variant: 'outline' },
};

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermission();

  const search = searchParams.get('search') || '';
  const department = searchParams.get('department') || '';
  const status = searchParams.get('status') || '';
  const page = searchParams.get('page') || '1';

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    department: department || undefined,
    status: status || undefined,
    page,
    pageSize: '20',
  });

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== 'page') params.delete('page');
    router.push(`/employees?${params.toString()}`);
  }

  const columns: ColumnDef<EmployeeWithRelations>[] = useMemo(
    () => [
      {
        accessorKey: 'firstName',
        header: 'Name',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <Link
              href={`/employees/${emp.id}`}
              className="flex items-center gap-3 hover:underline"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4B9EFF]/10 text-xs font-semibold text-[#4B9EFF]">
                {emp.firstName[0]}
                {emp.lastName[0]}
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {emp.firstName} {emp.lastName}
                </div>
                <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Department',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.department?.name || '-'}</span>
        ),
      },
      {
        accessorKey: 'designation',
        header: 'Designation',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.designation?.title || '-'}</span>
        ),
      },
      {
        accessorKey: 'region',
        header: 'Region',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.region}</Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = STATUS_BADGE[row.original.status] || { label: row.original.status, variant: 'outline' as const };
          return <Badge variant={s.variant}>{s.label}</Badge>;
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link href={`/employees/${row.original.id}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {can('employee:update') && (
              <Link href={`/employees/${row.original.id}/edit`}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        ),
      },
    ],
    [can]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Employees
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} employee${data.total !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        {can('employee:create') && (
          <Link href="/employees/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => updateParam('search', e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => updateParam('status', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            <SelectItem value="NOTICE_PERIOD">Notice Period</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data || []}
          pageSize={20}
          emptyMessage="No employees found."
        />
      )}

      {/* Server-side pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={Number(page) <= 1}
            onClick={() => updateParam('page', String(Number(page) - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={Number(page) >= data.totalPages}
            onClick={() => updateParam('page', String(Number(page) + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
