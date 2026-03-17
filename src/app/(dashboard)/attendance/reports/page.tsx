'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Download, Clock, AlertTriangle, Timer, Users } from 'lucide-react';
import { useAttendance } from '@/hooks/use-attendance';
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

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  PRESENT: { label: 'Present', variant: 'success' },
  LATE: { label: 'Late', variant: 'warning' },
  ABSENT: { label: 'Absent', variant: 'destructive' },
  HALF_DAY: { label: 'Half Day', variant: 'warning' },
  WORK_FROM_HOME: { label: 'WFH', variant: 'outline' },
  ON_LEAVE: { label: 'On Leave', variant: 'outline' },
};

export default function AttendanceReportsPage() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [month, setMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: rawData, isLoading } = useAttendance({
    month,
    pageSize: '100',
  });

  const records = useMemo(() => {
    if (!rawData) return [];
    const list = Array.isArray(rawData) ? rawData : (rawData as any).data ?? [];
    if (statusFilter && statusFilter !== 'all') {
      return list.filter((r: any) => r.status === statusFilter);
    }
    return list;
  }, [rawData, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    if (records.length === 0) return { totalRecords: 0, avgHours: 0, lateCount: 0, overtimeCount: 0, absentCount: 0 };
    const withHours = records.filter((r: any) => r.hoursWorked != null);
    const avgHours = withHours.length > 0
      ? withHours.reduce((sum: number, r: any) => sum + (r.hoursWorked ?? 0), 0) / withHours.length
      : 0;
    return {
      totalRecords: records.length,
      avgHours: Math.round(avgHours * 10) / 10,
      lateCount: records.filter((r: any) => r.isLate || r.status === 'LATE').length,
      overtimeCount: records.filter((r: any) => r.overtimeHours && r.overtimeHours > 0).length,
      absentCount: records.filter((r: any) => r.status === 'ABSENT').length,
    };
  }, [records]);

  function exportToCsv() {
    if (records.length === 0) return;
    const headers = ['Date', 'Employee', 'Clock In', 'Clock Out', 'Hours', 'Overtime', 'Status', 'Late'];
    const rows = records.map((r: any) => [
      format(new Date(r.date), 'yyyy-MM-dd'),
      r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId,
      r.clockIn ? format(new Date(r.clockIn), 'HH:mm') : '',
      r.clockOut ? format(new Date(r.clockOut), 'HH:mm') : '',
      r.hoursWorked?.toFixed(1) ?? '',
      r.overtimeHours?.toFixed(1) ?? '0',
      r.status,
      r.isLate ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/attendance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
              Attendance Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Team attendance data for {format(new Date(month + '-01'), 'MMMM yyyy')}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportToCsv} disabled={records.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Avg Hours/Day
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.avgHours}h</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Late Arrivals
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.lateCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            Overtime Days
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.overtimeCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Total Records
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.totalRecords}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-[180px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PRESENT">Present</SelectItem>
            <SelectItem value="LATE">Late</SelectItem>
            <SelectItem value="ABSENT">Absent</SelectItem>
            <SelectItem value="HALF_DAY">Half Day</SelectItem>
            <SelectItem value="WORK_FROM_HOME">WFH</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No records found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting the month or status filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-3">Employee</th>
                <th className="p-3">Date</th>
                <th className="p-3">Clock In</th>
                <th className="p-3">Clock Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Status</th>
                <th className="p-3">Late</th>
                <th className="p-3">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record: any) => {
                const si = STATUS_BADGE[record.status] ?? { label: record.status, variant: 'outline' as const };
                return (
                  <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {record.employee
                        ? `${record.employee.firstName} ${record.employee.lastName}`
                        : record.employeeId}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(record.date), 'EEE, MMM d')}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {record.clockOut ? format(new Date(record.clockOut), 'h:mm a') : '-'}
                    </td>
                    <td className="p-3">
                      {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : '-'}
                    </td>
                    <td className="p-3">
                      <Badge variant={si.variant}>{si.label}</Badge>
                    </td>
                    <td className="p-3">
                      {record.isLate ? (
                        <Badge variant="warning">Late</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {record.overtimeHours && record.overtimeHours > 0 ? (
                        <span className="text-amber-600">{record.overtimeHours.toFixed(1)}h</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
