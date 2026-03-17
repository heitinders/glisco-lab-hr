'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
  isWeekend,
  isToday,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
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
import { apiClient } from '@/lib/api';
import { useLeaveRequests } from '@/hooks/use-leave';
import type { PaginatedLeaveResponse } from '@/types/leave';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentsResponse {
  data: Department[];
}

// Color map for leave type badges in calendar cells
const LEAVE_TYPE_COLORS: Record<string, string> = {
  ANNUAL: 'bg-blue-500/15 text-blue-700 border-blue-200',
  SICK: 'bg-red-500/15 text-red-700 border-red-200',
  CASUAL: 'bg-violet-500/15 text-violet-700 border-violet-200',
  MATERNITY: 'bg-pink-500/15 text-pink-700 border-pink-200',
  PATERNITY: 'bg-cyan-500/15 text-cyan-700 border-cyan-200',
  BEREAVEMENT: 'bg-gray-500/15 text-gray-700 border-gray-200',
  COMPENSATORY: 'bg-amber-500/15 text-amber-700 border-amber-200',
  UNPAID: 'bg-orange-500/15 text-orange-700 border-orange-200',
  FMLA: 'bg-teal-500/15 text-teal-700 border-teal-200',
  PL: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  EL: 'bg-indigo-500/15 text-indigo-700 border-indigo-200',
};

function getLeaveColor(leaveType: string): string {
  return LEAVE_TYPE_COLORS[leaveType] || 'bg-gray-500/15 text-gray-700 border-gray-200';
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Navigation skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-10" />
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>

      {/* Calendar grid skeleton */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Fetch departments for the filter dropdown
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<DepartmentsResponse>('/api/departments'),
  });

  // Fetch approved leave requests for the current year
  // The API supports status and year filters
  const { data: leaveData, isLoading: isLeaveLoading } = useLeaveRequests({
    status: 'APPROVED',
    pageSize: '500', // Fetch a large page to get all approved leaves for the year
  });

  // ---------------------------------------------------------------------------
  // Calendar grid generation using date-fns
  // ---------------------------------------------------------------------------

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    // weekStartsOn: 1 = Monday
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // ---------------------------------------------------------------------------
  // Group approved leaves by date for fast lookup
  // ---------------------------------------------------------------------------

  const leavesByDate = useMemo(() => {
    const map = new Map<string, Array<{
      initials: string;
      fullName: string;
      leaveType: string;
      leaveTypeName: string;
      department: string;
    }>>();

    if (!leaveData?.data) return map;

    for (const leave of leaveData.data) {
      // Filter by department if selected
      if (
        selectedDepartment !== 'all' &&
        leave.employee.department?.name !== selectedDepartment
      ) {
        continue;
      }

      const start = parseISO(leave.startDate as unknown as string);
      const end = parseISO(leave.endDate as unknown as string);

      // Expand the leave across all days in its range
      const daysInRange = eachDayOfInterval({ start, end });

      for (const day of daysInRange) {
        // Only include days that fall within the currently visible month range
        const dateKey = format(day, 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        existing.push({
          initials: getInitials(leave.employee.firstName, leave.employee.lastName),
          fullName: `${leave.employee.firstName} ${leave.employee.lastName}`,
          leaveType: leave.leaveType.leaveType,
          leaveTypeName: leave.leaveType.name,
          department: leave.employee.department?.name || '',
        });
        map.set(dateKey, existing);
      }
    }

    return map;
  }, [leaveData, selectedDepartment]);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const goToPreviousMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const goToNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  // ---------------------------------------------------------------------------
  // Day header labels
  // ---------------------------------------------------------------------------

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLeaveLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Leave Calendar
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualize team availability on a shared calendar. See who is on
            leave, plan around absences, and identify potential coverage gaps
            across departments.
          </p>
        </div>

        {/* Department filter */}
        <div className="flex items-center gap-3 shrink-0">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentsData?.data?.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-lg border border-[#0B0F1A]/10 bg-white px-4 py-3">
        <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-[#4B9EFF]" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
            Today
          </Button>
        </div>

        <Button variant="outline" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border border-[#0B0F1A]/10 bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#0B0F1A]/10 bg-[#0B0F1A]/[0.02]">
          {dayHeaders.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const isWeekendDay = isWeekend(day);
            const leavesForDay = leavesByDate.get(dateKey) || [];

            return (
              <div
                key={dateKey}
                className={`
                  relative min-h-[100px] border-b border-r border-[#0B0F1A]/5 p-1.5
                  transition-colors
                  ${!isCurrentMonth ? 'bg-[#0B0F1A]/[0.02]' : ''}
                  ${isWeekendDay && isCurrentMonth ? 'bg-[#0B0F1A]/[0.03]' : ''}
                  ${isTodayDate ? 'bg-[#4B9EFF]/[0.04]' : ''}
                  ${index % 7 === 6 ? 'border-r-0' : ''}
                `}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`
                      inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                      ${isTodayDate
                        ? 'bg-[#4B9EFF] text-white font-semibold'
                        : isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/40'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </span>
                  {isWeekendDay && isCurrentMonth && (
                    <span className="text-[10px] text-muted-foreground/50 font-medium">
                      Off
                    </span>
                  )}
                </div>

                {/* Leave entries */}
                {isCurrentMonth && leavesForDay.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {leavesForDay.slice(0, 3).map((leave, i) => (
                      <div
                        key={`${leave.initials}-${leave.leaveType}-${i}`}
                        className={`
                          flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium
                          border truncate
                          ${getLeaveColor(leave.leaveType)}
                        `}
                        title={`${leave.fullName} - ${leave.leaveTypeName}`}
                      >
                        <span className="shrink-0 font-semibold">{leave.initials}</span>
                        <span className="truncate">{leave.leaveTypeName}</span>
                      </div>
                    ))}
                    {leavesForDay.length > 3 && (
                      <div className="px-1 text-[10px] font-medium text-muted-foreground">
                        +{leavesForDay.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#0B0F1A]/10 bg-white px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#4B9EFF] text-[10px] font-bold text-white">
            16
          </span>
          <span className="text-xs text-muted-foreground">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-[#0B0F1A]/[0.03] border border-[#0B0F1A]/10" />
          <span className="text-xs text-muted-foreground">Weekend</span>
        </div>
        {Object.entries({
          ANNUAL: 'Annual',
          SICK: 'Sick',
          CASUAL: 'Casual',
          UNPAID: 'Unpaid',
        }).map(([code, label]) => (
          <div key={code} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-6 rounded border ${getLeaveColor(code)}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {leaveData?.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#0B0F1A]/15 bg-white py-16">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            No approved leaves for this period
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Approved leave requests will appear on the calendar
          </p>
        </div>
      )}

      {/* TODO: Integrate holiday data from GET /api/leave/holidays?year=YYYY endpoint */}
      {/* Holidays should be shown with a distinct background color on their respective dates */}
    </div>
  );
}
