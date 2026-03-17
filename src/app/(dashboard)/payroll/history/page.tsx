'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Download, DollarSign } from 'lucide-react';
import { usePayrollRuns } from '@/hooks/use-payroll';
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

export default function PayrollHistoryPage() {
  const now = new Date();
  const [year, setYear] = useState<string>('all');
  const [region, setRegion] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState('1');

  const { data: runsData, isLoading } = usePayrollRuns({
    page,
    pageSize: '20',
    ...(year !== 'all' && { year }),
    ...(region !== 'all' && { region }),
    ...(status !== 'all' && { status }),
  });

  const runs = runsData?.data ?? [];
  const totalPages = runsData?.totalPages ?? 1;

  function exportSummary() {
    if (runs.length === 0) return;
    const headers = ['Period', 'Region', 'Status', 'Currency', 'Employees', 'Gross', 'Net', 'Tax', 'Created'];
    const rows = runs.map((r) => [
      r.period,
      r.region,
      r.status,
      r.currency,
      r._count?.payslips ?? 0,
      r.totalGross,
      r.totalNet,
      r.totalTax,
      format(new Date(r.createdAt), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/payroll">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
              Payroll History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse historical payroll records
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportSummary} disabled={runs.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export Summary
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={year} onValueChange={(v) => { setYear(v); setPage('1'); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={(v) => { setRegion(v); setPage('1'); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            <SelectItem value="US">US</SelectItem>
            <SelectItem value="INDIA">India</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage('1'); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No payroll records</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting the filters or create a new payroll run.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Period</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Employees</th>
                  <th className="p-3 text-right">Gross</th>
                  <th className="p-3 text-right">Tax</th>
                  <th className="p-3 text-right">Net</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Paid At</th>
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
                      <td className="p-3 text-muted-foreground">{run._count?.payslips ?? '-'}</td>
                      <td className="p-3 text-right">{formatCurrency(run.totalGross, run.currency)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(run.totalTax, run.currency)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(run.totalNet, run.currency)}</td>
                      <td className="p-3">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {run.processedAt
                          ? format(new Date(run.processedAt), 'MMM d, yyyy')
                          : '-'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({runsData?.total ?? 0} records)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Number(page) <= 1}
                  onClick={() => setPage(String(Number(page) - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Number(page) >= totalPages}
                  onClick={() => setPage(String(Number(page) + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
