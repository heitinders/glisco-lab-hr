'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Banknote,
  Loader2,
  Download,
  DollarSign,
} from 'lucide-react';
import {
  usePayrollRunDetail,
  useCreatePayrollRun,
  useUpdatePayrollRunStatus,
} from '@/hooks/use-payroll';
import { usePermission } from '@/hooks/use-permissions';
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
import { Input } from '@/components/ui/input';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PROCESSING: { label: 'Processing', variant: 'secondary' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  PAID: { label: 'Paid', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

function formatCurrency(val: string | number | null | undefined, currency: string) {
  if (val == null) return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPeriod(period: string) {
  const [y, m] = period.split('-');
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy');
}

export default function RunPayrollPage() {
  const searchParams = useSearchParams();
  const runId = searchParams.get('id');

  if (runId) {
    return <ViewPayrollRun runId={runId} />;
  }
  return <CreatePayrollRun />;
}

// ─── Create Payroll Run ──────────────────────────────────────────────────────

function CreatePayrollRun() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [region, setRegion] = useState<string>('');
  const [notes, setNotes] = useState('');

  const createRun = useCreatePayrollRun();
  const { can } = usePermission();

  async function handleCreate() {
    if (!region) {
      toast.error('Please select a region');
      return;
    }

    try {
      const result = await createRun.mutateAsync({
        month: Number(month),
        year: Number(year),
        region,
        notes: notes || undefined,
      });
      toast.success('Payroll run created successfully');
      // Redirect to the run detail
      const runData = (result as any).data;
      if (runData?.id) {
        window.location.href = `/payroll/run?id=${runData.id}`;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create payroll run');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/payroll">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            New Payroll Run
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new payroll run for the selected period and region
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-lg border p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Month</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {format(new Date(2024, i, 1), 'MMMM')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Region</label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="INDIA">India</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Notes (optional)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this payroll run..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/payroll">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={handleCreate}
            disabled={!can('payroll:run') || createRun.isPending}
          >
            {createRun.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-2 h-4 w-4" />
            Create Payroll Run
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── View Payroll Run ────────────────────────────────────────────────────────

function ViewPayrollRun({ runId }: { runId: string }) {
  const { data: runResult, isLoading } = usePayrollRunDetail(runId);
  const updateStatus = useUpdatePayrollRunStatus();
  const { can } = usePermission();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const run = runResult?.data ?? null;

  async function handleAction(action: 'PROCESS' | 'APPROVE' | 'REJECT' | 'PAY') {
    try {
      await updateStatus.mutateAsync({ runId, action });
      toast.success(`Payroll run ${action.toLowerCase()}ed successfully`);
      setConfirmAction(null);
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action.toLowerCase()} payroll run`);
    }
  }

  function exportToCsv() {
    if (!run?.payslips?.length) return;
    const headers = ['Employee ID', 'Employee Name', 'Department', 'Basic', 'Gross', 'Tax', 'Net', 'Currency'];
    const rows = run.payslips.map((p) => [
      p.employee?.employeeId ?? p.employeeId,
      p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : p.employeeId,
      p.employee?.department?.name ?? '',
      p.basicSalary,
      p.grossPay,
      p.taxDeducted,
      p.netPay,
      p.currency,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${run.period}-${run.region}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border p-12 text-center">
          <h3 className="text-lg font-medium text-foreground">Run not found</h3>
          <Link href="/payroll" className="mt-4 inline-block">
            <Button variant="outline">Back to Payroll</Button>
          </Link>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[run.status] ?? { label: run.status, variant: 'outline' as const };
  const payslips = run.payslips ?? [];

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
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
                {formatPeriod(run.period)}
              </h1>
              <Badge variant={sc.variant}>{sc.label}</Badge>
              <Badge variant="outline">{run.region}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {payslips.length} employees · Created {format(new Date(run.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCsv} disabled={payslips.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Gross</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(run.totalGross, run.currency)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Tax</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(run.totalTax, run.currency)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Net Pay</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(run.totalNet, run.currency)}
          </div>
        </div>
      </div>

      {/* Actions */}
      {confirmAction ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-medium text-foreground">
            Are you sure you want to {confirmAction.toLowerCase()} this payroll run?
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant={confirmAction === 'REJECT' ? 'destructive' : 'default'}
              onClick={() => handleAction(confirmAction as any)}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm {confirmAction}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {run.status === 'DRAFT' && can('payroll:run') && (
            <Button onClick={() => setConfirmAction('PROCESS')}>
              <Play className="mr-2 h-4 w-4" />
              Process
            </Button>
          )}
          {run.status === 'PENDING_APPROVAL' && can('payroll:approve') && (
            <>
              <Button onClick={() => setConfirmAction('APPROVE')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setConfirmAction('REJECT')}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {run.status === 'APPROVED' && can('payroll:run') && (
            <Button onClick={() => setConfirmAction('PAY')}>
              <Banknote className="mr-2 h-4 w-4" />
              Mark as Paid
            </Button>
          )}
        </div>
      )}

      {/* Payslips Table */}
      {payslips.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Basic</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Tax</th>
                <th className="p-3 text-right">Net Pay</th>
                <th className="p-3">PDF</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => (
                <tr key={slip.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">
                      {slip.employee
                        ? `${slip.employee.firstName} ${slip.employee.lastName}`
                        : slip.employeeId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {slip.employee?.employeeId}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {slip.employee?.department?.name ?? '-'}
                  </td>
                  <td className="p-3 text-right">{formatCurrency(slip.basicSalary, slip.currency)}</td>
                  <td className="p-3 text-right">{formatCurrency(slip.grossPay, slip.currency)}</td>
                  <td className="p-3 text-right">{formatCurrency(slip.taxDeducted, slip.currency)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(slip.netPay, slip.currency)}</td>
                  <td className="p-3">
                    {slip.pdfUrl ? (
                      <a href={slip.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
