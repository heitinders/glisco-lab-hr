'use client';

import { useState, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuditLog, type AuditLogEntry } from '@/hooks/use-settings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'IMPORT',
] as const;

const RESOURCE_TYPES = [
  'User',
  'Employee',
  'Department',
  'Designation',
  'LeaveRequest',
  'LeaveBalance',
  'Attendance',
  'Payroll',
  'PerformanceCycle',
  'PerformanceReview',
  'Goal',
  'Job',
  'Candidate',
  'Document',
  'Company',
] as const;

const ACTION_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  CREATE: 'success',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  LOGIN: 'outline',
  LOGOUT: 'outline',
  EXPORT: 'warning',
  IMPORT: 'warning',
};

// ---------------------------------------------------------------------------
// JSON diff viewer
// ---------------------------------------------------------------------------

function ChangesCell({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const hasBefore = entry.before && Object.keys(entry.before).length > 0;
  const hasAfter = entry.after && Object.keys(entry.after).length > 0;

  if (!hasBefore && !hasAfter) {
    return <span className="text-muted-foreground">--</span>;
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {expanded ? 'Hide' : 'View'}
      </Button>
      {expanded && (
        <div className="mt-2 max-w-md space-y-2 rounded-md border border-[#0B0F1A]/10 bg-[#0B0F1A]/[0.02] p-3 text-xs">
          {hasBefore && (
            <div>
              <span className="font-semibold text-red-600">Before:</span>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                {JSON.stringify(entry.before, null, 2)}
              </pre>
            </div>
          )}
          {hasAfter && (
            <div>
              <span className="font-semibold text-emerald-600">After:</span>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                {JSON.stringify(entry.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<AuditLogEntry, any>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Timestamp',
    cell: ({ row }) =>
      format(new Date(row.original.createdAt), 'MMM d, yyyy HH:mm:ss'),
  },
  {
    id: 'actorEmail',
    header: 'Actor',
    accessorFn: (row) => row.actor?.email ?? 'System',
    cell: ({ row }) => {
      const actor = row.original.actor;
      if (!actor) {
        return <span className="text-muted-foreground italic">System</span>;
      }
      return <span className="font-medium">{actor.email}</span>;
    },
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <Badge variant={ACTION_BADGE_VARIANT[row.original.action] || 'outline'}>
        {row.original.action}
      </Badge>
    ),
  },
  {
    accessorKey: 'resource',
    header: 'Resource Type',
    cell: ({ row }) => row.original.resource,
  },
  {
    accessorKey: 'resourceId',
    header: 'Resource ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.resourceId}</span>
    ),
  },
  {
    id: 'changes',
    header: 'Changes',
    cell: ({ row }) => <ChangesCell entry={row.original} />,
    enableSorting: false,
  },
];

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportToCsv(entries: AuditLogEntry[]) {
  const headers = [
    'Timestamp',
    'Actor Email',
    'Actor Role',
    'Action',
    'Resource',
    'Resource ID',
    'Before',
    'After',
    'IP Address',
  ];

  const rows = entries.map((e) => [
    e.createdAt,
    e.actor?.email ?? 'System',
    e.actor?.role ?? '',
    e.action,
    e.resource,
    e.resourceId,
    e.before ? JSON.stringify(e.before) : '',
    e.after ? JSON.stringify(e.after) : '',
    e.ipAddress ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState('1');

  const filters = useMemo(
    () => ({
      page,
      pageSize: '20',
      ...(action && { action }),
      ...(resource && { resource }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    }),
    [action, resource, dateFrom, dateTo, page],
  );

  const { data, isLoading, isError } = useAuditLog(filters);

  const handleExport = useCallback(() => {
    if (!data?.data?.length) {
      toast.error('No data to export');
      return;
    }
    exportToCsv(data.data);
    toast.success('Audit log exported as CSV');
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-[#4B9EFF]" />
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Audit Log
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          View a chronological record of all system changes. Filter by action
          type, resource, or date range.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Action filter */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v === 'all' ? '' : v);
              setPage('1');
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resource filter */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Resource
          </label>
          <Select
            value={resource}
            onValueChange={(v) => {
              setResource(v === 'all' ? '' : v);
              setPage('1');
            }}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="All Resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              {RESOURCE_TYPES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <Input
            type="date"
            className="h-9 w-[160px]"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage('1');
            }}
          />
        </div>

        {/* Date to */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input
            type="date"
            className="h-9 w-[160px]"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage('1');
            }}
          />
        </div>

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleExport}
          disabled={!data?.data?.length}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats line */}
      {data && (
        <p className="text-sm text-muted-foreground">
          Showing {data.data.length} of {data.total} entries
          {data.totalPages > 1 && ` (page ${data.page} of ${data.totalPages})`}
        </p>
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
          Failed to load audit log. Please try again.
        </div>
      )}

      {/* Data table */}
      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          emptyMessage="No audit log entries found."
          pageSize={20}
        />
      )}

      {/* Server-side pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => setPage(String(data.page - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => setPage(String(data.page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
