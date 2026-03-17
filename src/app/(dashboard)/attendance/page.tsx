'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, Timer, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useClockStatus, useClockInOut, useAttendance } from '@/hooks/use-attendance';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  PRESENT: { label: 'Present', variant: 'success' },
  LATE: { label: 'Late', variant: 'warning' },
  ABSENT: { label: 'Absent', variant: 'destructive' },
  HALF_DAY: { label: 'Half Day', variant: 'warning' },
  WORK_FROM_HOME: { label: 'WFH', variant: 'outline' },
  ON_LEAVE: { label: 'On Leave', variant: 'outline' },
};

export default function AttendancePage() {
  const { data: clockData, isLoading: clockLoading } = useClockStatus();
  const clockMutation = useClockInOut();
  const { can } = usePermission();

  // Fetch current month attendance
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: monthData, isLoading: monthLoading } = useAttendance({ month: currentMonth });

  const isClockedIn = clockData?.isClockedIn ?? false;
  const todayRecord = clockData?.data ?? null;

  const weekSummary = useMemo(() => {
    if (!monthData) return [];
    const records = Array.isArray(monthData) ? monthData : (monthData as any).data ?? [];
    return records.slice(0, 7); // Last 7 records
  }, [monthData]);

  async function handleClock(action: 'clock_in' | 'clock_out') {
    try {
      await clockMutation.mutateAsync(action);
      toast.success(action === 'clock_in' ? 'Clocked in successfully' : 'Clocked out successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record attendance';
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your daily attendance and work hours.
          </p>
        </div>
        {can('attendance:view_team') && (
          <Link href="/attendance/reports">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Team Reports
            </Button>
          </Link>
        )}
      </div>

      {/* Clock In/Out Card */}
      <div className="rounded-lg border p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-heading text-lg text-foreground">Today&apos;s Status</h3>
            </div>
            {clockLoading ? (
              <Skeleton className="mt-2 h-5 w-40" />
            ) : todayRecord ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Clocked in at{' '}
                  <span className="font-medium text-foreground">
                    {todayRecord.clockIn ? format(new Date(todayRecord.clockIn), 'h:mm a') : '-'}
                  </span>
                </p>
                {todayRecord.clockOut && (
                  <p className="text-sm text-muted-foreground">
                    Clocked out at{' '}
                    <span className="font-medium text-foreground">
                      {format(new Date(todayRecord.clockOut), 'h:mm a')}
                    </span>
                    {' '}&middot;{' '}
                    <span className="font-medium text-foreground">
                      {todayRecord.hoursWorked?.toFixed(1)}h worked
                    </span>
                  </p>
                )}
                <Badge variant={STATUS_BADGE[todayRecord.status]?.variant ?? 'outline'}>
                  {STATUS_BADGE[todayRecord.status]?.label ?? todayRecord.status}
                </Badge>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not clocked in yet today.</p>
            )}
          </div>

          {/* Clock Button */}
          <div>
            {clockLoading ? (
              <Skeleton className="h-12 w-36" />
            ) : todayRecord?.clockOut ? (
              <Button disabled variant="outline" size="lg">
                <Clock className="mr-2 h-4 w-4" />
                Completed Today
              </Button>
            ) : (
              <Button
                size="lg"
                variant={isClockedIn ? 'destructive' : 'default'}
                onClick={() => handleClock(isClockedIn ? 'clock_out' : 'clock_in')}
                disabled={clockMutation.isPending}
              >
                {isClockedIn ? (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Clock Out
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Clock In
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 font-heading text-lg text-foreground">Recent Attendance</h3>
        {monthLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : weekSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Clock In</th>
                  <th className="pb-2 pr-4">Clock Out</th>
                  <th className="pb-2 pr-4">Hours</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {weekSummary.map((record: any) => {
                  const statusInfo = STATUS_BADGE[record.status] ?? { label: record.status, variant: 'outline' as const };
                  return (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">
                        {format(new Date(record.date), 'EEE, MMM d')}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '-'}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {record.clockOut ? format(new Date(record.clockOut), 'h:mm a') : '-'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="py-2.5">
                        {record.overtimeHours ? (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Timer className="h-3 w-3" />
                            {record.overtimeHours.toFixed(1)}h
                          </span>
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
    </div>
  );
}
