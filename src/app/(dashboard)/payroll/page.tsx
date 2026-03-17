'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  DollarSign,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { usePayrollRuns } from '@/hooks/use-payroll';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PROCESSING: { label: 'Processing', variant: 'secondary' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  PAID: { label: 'Paid', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

function formatCurrency(val: string | number, currency: string) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPeriod(period: string) {
  const [y, m] = period.split('-');
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy');
}

export default function PayrollPage() {
  const { can } = usePermission();
  const { data: runsData, isLoading } = usePayrollRuns({ pageSize: '10' });

  const runs = useMemo(() => {
    if (!runsData) return [];
    return runsData.data ?? [];
  }, [runsData]);

  const stats = useMemo(() => {
    if (runs.length === 0) return { pending: 0, totalPaid: 0, latestStatus: null as string | null };
    const pending = runs.filter((r) => r.status === 'PENDING_APPROVAL').length;
    const paidRuns = runs.filter((r) => r.status === 'PAID');
    const totalPaid = paidRuns.reduce((sum, r) => sum + (typeof r.totalNet === 'string' ? parseFloat(r.totalNet) : r.totalNet), 0);
    return { pending, totalPaid, latestStatus: runs[0]?.status ?? null };
  }, [runs]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Payroll
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage payroll processing for your organization
          </p>
        </div>
        {can('payroll:run') && (
          <Link href="/payroll/run">
            <Button>
              <Play className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Latest Run Status
          </div>
          <div className="mt-1">
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : stats.latestStatus ? (
              <Badge variant={STATUS_CONFIG[stats.latestStatus]?.variant ?? 'outline'}>
                {STATUS_CONFIG[stats.latestStatus]?.label ?? stats.latestStatus}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">No runs yet</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Pending Approvals
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {isLoading ? <Skeleton className="h-8 w-16" /> : stats.pending}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Total Paid (Recent)
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              formatCurrency(stats.totalPaid, 'USD')
            )}
          </div>
        </div>
      </div>

      {/* Recent Payroll Runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Payroll Runs</h2>
          <Link href="/payroll/history">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-lg border p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No payroll runs</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first payroll run to get started.
            </p>
            {can('payroll:run') && (
              <Link href="/payroll/run" className="mt-4 inline-block">
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  New Payroll Run
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Period</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Employees</th>
                  <th className="p-3">Gross</th>
                  <th className="p-3">Net</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const sc = STATUS_CONFIG[run.status] ?? { label: run.status, variant: 'outline' as const };
                  return (
                    <tr key={run.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{formatPeriod(run.period)}</td>
                      <td className="p-3">
                        <Badge variant="outline">{run.region}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {run._count?.payslips ?? '-'}
                      </td>
                      <td className="p-3">{formatCurrency(run.totalGross, run.currency)}</td>
                      <td className="p-3 font-medium">{formatCurrency(run.totalNet, run.currency)}</td>
                      <td className="p-3">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(run.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="p-3">
                        <Link href={`/payroll/run?id=${run.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
