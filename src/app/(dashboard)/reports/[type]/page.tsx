'use client';

import { use, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Download,
  Users,
  CalendarOff,
  DollarSign,
  TrendingDown,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useReport, type ReportFilters } from '@/hooks/use-reports';

// ─── Report metadata ────────────────────────────────────────────────────────

const REPORT_META: Record<
  string,
  { title: string; description: string; icon: React.ReactNode }
> = {
  headcount: {
    title: 'Headcount Report',
    description: 'Employee distribution by department, role, and region',
    icon: <Users className="h-5 w-5" />,
  },
  leave: {
    title: 'Leave Report',
    description: 'Leave utilization and patterns',
    icon: <CalendarOff className="h-5 w-5" />,
  },
  payroll: {
    title: 'Payroll Report',
    description: 'Payroll summaries by period and region',
    icon: <DollarSign className="h-5 w-5" />,
  },
  turnover: {
    title: 'Turnover Report',
    description: 'Employee joins and exits',
    icon: <TrendingDown className="h-5 w-5" />,
  },
  compliance: {
    title: 'Compliance Report',
    description: 'Expiring documents and missing compliance items',
    icon: <Shield className="h-5 w-5" />,
  },
};

const VALID_TYPES = ['headcount', 'leave', 'payroll', 'turnover', 'compliance'];

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'US', label: 'US' },
  { value: 'INDIA', label: 'India' },
  { value: 'REMOTE', label: 'Remote' },
];

// ─── CSV Export ─────────────────────────────────────────────────────────────

function exportToCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string
) {
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        const str = val == null ? '' : String(val);
        // Escape CSV values that contain commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Table skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  type,
}: {
  summary: Record<string, unknown>;
  type: string;
}) {
  // Extract top-level scalar values for summary cards
  const scalarEntries = Object.entries(summary).filter(
    ([, v]) => typeof v !== 'object' || v === null
  );

  // Limit to 4 cards max for a clean layout
  const displayEntries = scalarEntries.slice(0, 4);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {displayEntries.map(([key, value]) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-[Syne] text-[#0B0F1A]/60">
              {formatSummaryLabel(key)}
            </CardTitle>
            <div className="text-[#4B9EFF]">
              {REPORT_META[type]?.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-[&quot;DM_Serif_Display&quot;] text-[#0B0F1A]">
              {String(value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatSummaryLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = use(params);

  const [filters, setFilters] = useState<ReportFilters>({});

  const isValidType = VALID_TYPES.includes(type);

  const { data: report, isLoading, isError, error } = useReport(
    isValidType ? type : '',
    filters
  );

  const handleFilterChange = useCallback(
    (key: keyof ReportFilters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
      }));
    },
    []
  );

  const handleExportCSV = useCallback(() => {
    if (!report) return;
    exportToCSV(report.data, report.columns, `${type}-report`);
  }, [report, type]);

  const meta = REPORT_META[type];

  // Invalid type error state
  if (!isValidType) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reports
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-[#0B0F1A]">
              Invalid Report Type
            </h2>
            <p className="mt-2 text-sm text-[#0B0F1A]/60">
              The report type &quot;{type}&quot; is not recognized. Please select
              a valid report from the reports page.
            </p>
            <Link href="/reports" className="mt-4">
              <Button variant="secondary">View All Reports</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/reports">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reports
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#4B9EFF]/10 p-2 text-[#4B9EFF]">
              {meta?.icon}
            </div>
            <div>
              <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
                {meta?.title ?? 'Report'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {meta?.description}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={!report?.data?.length}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#0B0F1A]/60">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#0B0F1A]/60">
              End Date
            </label>
            <Input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#0B0F1A]/60">
              Region
            </label>
            <Select
              value={filters.region ?? ''}
              onValueChange={(val) => handleFilterChange('region', val)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value || '__all'} value={r.value || '__all'}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({})}
            className="text-[#0B0F1A]/60"
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
            <h2 className="text-lg font-semibold text-[#0B0F1A]">
              Failed to Load Report
            </h2>
            <p className="mt-2 text-sm text-[#0B0F1A]/60">
              {(error as any)?.message ?? 'An unexpected error occurred.'}
            </p>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary */}
          <SummaryCards summary={report.summary} type={type} />

          {/* Data Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {report.data.length} record{report.data.length !== 1 ? 's' : ''}
              </CardTitle>
              {report.data.length > 0 && (
                <Badge variant="outline">{type.toUpperCase()}</Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {report.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-[#0B0F1A]/60">
                    No data found for the selected filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {report.columns.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.data.map((row, idx) => (
                        <TableRow key={idx}>
                          {report.columns.map((col) => (
                            <TableCell key={col.key}>
                              {renderCell(col.key, row[col.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// ─── Cell Renderer ──────────────────────────────────────────────────────────

function renderCell(key: string, value: unknown): React.ReactNode {
  if (value == null) return '-';

  const str = String(value);

  // Render status / severity / event fields as badges
  if (key === 'status' || key === 'severity' || key === 'event') {
    const variant = getBadgeVariant(str);
    return <Badge variant={variant}>{str}</Badge>;
  }

  return str;
}

function getBadgeVariant(
  value: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const upper = value.toUpperCase();

  if (
    ['ACTIVE', 'APPROVED', 'PAID', 'JOINED', 'COMPLETED', 'LOW'].includes(
      upper
    )
  ) {
    return 'secondary';
  }

  if (
    ['TERMINATED', 'REJECTED', 'FAILED', 'EXITED', 'HIGH', 'EXPIRED'].includes(
      upper
    )
  ) {
    return 'destructive';
  }

  if (
    ['PENDING', 'DRAFT', 'PROCESSING', 'MEDIUM', 'ON_LEAVE', 'NOTICE_PERIOD'].includes(
      upper
    )
  ) {
    return 'outline';
  }

  return 'default';
}
