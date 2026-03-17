'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  Plus,
  Check,
  X,
  Calendar,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLeaveRequests, useLeaveBalance, useApproveLeaveRequest } from '@/hooks/use-leave';
import { usePermission } from '@/hooks/use-permissions';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LeaveRequestWithRelations } from '@/types/leave';
import type { LeaveBalanceSummary } from '@/types/leave';

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

function LeaveBalanceCards() {
  const currentYear = new Date().getFullYear().toString();
  const { data: balanceData, isLoading } = useLeaveBalance({ year: currentYear });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const balances = (balanceData?.data || []) as LeaveBalanceSummary[];

  if (balances.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {balances.map((balance) => {
        const utilization =
          balance.entitled > 0
            ? Math.round(((balance.used + balance.pending) / balance.entitled) * 100)
            : 0;

        return (
          <div
            key={balance.leaveTypeId}
            className="rounded-lg border border-[#0B0F1A]/10 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold font-[Syne] text-foreground">
                {balance.leaveTypeName}
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {balance.leaveTypeCode}
              </Badge>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-[Syne]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entitled</span>
                <span className="font-medium text-foreground">{balance.entitled}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium text-foreground">{balance.used}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-amber-600">{balance.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available</span>
                <span className="font-semibold text-emerald-600">{balance.available}</span>
              </div>
            </div>

            {/* Utilization progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-[Syne] text-muted-foreground">
                <span>Utilization</span>
                <span>{utilization}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0B0F1A]/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(utilization, 100)}%`,
                    backgroundColor:
                      utilization >= 90
                        ? '#ef4444'
                        : utilization >= 70
                          ? '#f59e0b'
                          : '#10b981',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionCell({ request }: { request: LeaveRequestWithRelations }) {
  const { mutateAsync: approve, isPending } = useApproveLeaveRequest(request.id);

  async function handleAction(action: 'APPROVED' | 'REJECTED') {
    try {
      await approve({ action });
      toast.success(
        action === 'APPROVED'
          ? 'Leave request approved'
          : 'Leave request rejected'
      );
    } catch {
      toast.error('Failed to update leave request');
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
        disabled={isPending}
        onClick={() => handleAction('APPROVED')}
        title="Approve"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-red-600 hover:bg-red-500/10 hover:text-red-700"
        disabled={isPending}
        onClick={() => handleAction('REJECTED')}
        title="Reject"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function LeaveManagementPage() {
  const { can, canAny } = usePermission();
  const canApprove = canAny(['leave:approve_team', 'leave:approve_all']);

  const currentYear = new Date().getFullYear();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>(currentYear.toString());

  const { data, isLoading } = useLeaveRequests({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    pageSize: '20',
  });

  const columns: ColumnDef<LeaveRequestWithRelations>[] = useMemo(
    () => [
      {
        accessorKey: 'employee',
        header: 'Employee',
        cell: ({ row }) => {
          const req = row.original;
          const emp = req.employee;
          return (
            <Link
              href={`/employees/${req.employeeId}`}
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
        accessorKey: 'leaveType',
        header: 'Leave Type',
        cell: ({ row }) => (
          <span className="text-sm font-[Syne]">{row.original.leaveType.name}</span>
        ),
      },
      {
        accessorKey: 'startDate',
        header: 'Start Date',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.startDate), 'MMM dd, yyyy')}
          </span>
        ),
      },
      {
        accessorKey: 'endDate',
        header: 'End Date',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.endDate), 'MMM dd, yyyy')}
          </span>
        ),
      },
      {
        accessorKey: 'totalDays',
        header: 'Days',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.totalDays}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = STATUS_BADGE[row.original.status] || {
            label: row.original.status,
            variant: 'outline' as const,
          };
          return <Badge variant={s.variant}>{s.label}</Badge>;
        },
      },
      ...(canApprove
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }: { row: { original: LeaveRequestWithRelations } }) => {
                if (row.original.status !== 'PENDING') return null;
                return <ActionCell request={row.original} />;
              },
            } as ColumnDef<LeaveRequestWithRelations>,
          ]
        : []),
    ],
    [canApprove]
  );

  const yearOptions = useMemo(() => {
    const years: string[] = [];
    for (let y = currentYear; y >= currentYear - 3; y--) {
      years.push(y.toString());
    }
    return years;
  }, [currentYear]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Leave Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {data.total} request{data.total !== 1 ? 's' : ''}
              </span>
            ) : (
              'Loading...'
            )}
          </p>
        </div>
        {can('leave:request') && (
          <Link href="/leave/apply">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Apply for Leave
            </Button>
          </Link>
        )}
      </div>

      {/* Leave Balance Cards */}
      <LeaveBalanceCards />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={(v) => setYearFilter(v)}>
          <SelectTrigger className="w-[120px]">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data || []}
          searchKey="employee"
          searchPlaceholder="Search by employee name..."
          pageSize={20}
          emptyMessage="No leave requests found."
        />
      )}

      {/* Server-side pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
