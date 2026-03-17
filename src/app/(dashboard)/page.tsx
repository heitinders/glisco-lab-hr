'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarOff,
  ClipboardCheck,
  Briefcase,
  UserPlus,
  CheckCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Star,
  Calendar,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStats, type DashboardData } from '@/hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Greeting header */}
      <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : data?.role === 'hr' ? (
        <HRDashboard data={data} />
      ) : data?.role === 'manager' ? (
        <ManagerDashboard data={data} />
      ) : data?.role === 'employee' ? (
        <EmployeeDashboard data={data} />
      ) : null}

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <QuickAction href="/leave/apply" icon={Calendar} label="Apply Leave" />
          <QuickAction href="/performance/reviews" icon={Star} label="My Reviews" />
          <QuickAction href="/performance/goals" icon={Target} label="Goals" />
          {data?.role === 'hr' && (
            <>
              <QuickAction href="/employees/new" icon={UserPlus} label="Add Employee" />
              <QuickAction href="/leave" icon={CheckCircle} label="Approve Leave" />
              <QuickAction href="/payroll/run" icon={DollarSign} label="Run Payroll" />
            </>
          )}
          {data?.role === 'manager' && (
            <QuickAction href="/leave" icon={CheckCircle} label="Approve Leave" />
          )}
        </div>
      </section>
    </div>
  );
}

/* ── HR Dashboard ──────────────────────────────────────────────────── */

function HRDashboard({ data }: { data: Extract<DashboardData, { role: 'hr' }> }) {
  const { stats, charts } = data;
  const totalForBar = stats.totalEmployees || 1;

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={String(stats.totalEmployees)}
          change={stats.employeeChange >= 0 ? `+${stats.employeeChange}` : String(stats.employeeChange)}
          changeLabel="vs last month"
          trend={stats.employeeChange > 0 ? 'up' : stats.employeeChange < 0 ? 'down' : 'neutral'}
          icon={Users}
          accentColor="bg-blue-light text-blue"
        />
        <StatCard
          title="On Leave Today"
          value={String(stats.onLeaveToday)}
          change={String(stats.pendingLeaves)}
          changeLabel="pending approval"
          trend="neutral"
          icon={CalendarOff}
          accentColor="bg-warning-light text-warning"
        />
        <StatCard
          title="Pending Approvals"
          value={String(stats.pendingLeaves)}
          change={String(stats.hiresThisMonth)}
          changeLabel="new hires this month"
          trend="up"
          icon={ClipboardCheck}
          accentColor="bg-error-light text-error"
        />
        <StatCard
          title="Open Positions"
          value={String(stats.openPositions)}
          change={String(stats.activeReviewCycles)}
          changeLabel="active review cycles"
          trend="neutral"
          icon={Briefcase}
          accentColor="bg-success-light text-success"
        />
      </section>

      {/* Headcount by Department */}
      {charts.headcountByDepartment.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-base text-card-foreground">
              Headcount by Department
            </h3>
            <Link href="/reports/headcount" className="text-xs font-medium text-blue hover:text-blue-hover">
              View report
            </Link>
          </div>
          <div className="space-y-3">
            {charts.headcountByDepartment.map((dept) => (
              <DepartmentBar
                key={dept.department}
                name={dept.department}
                count={dept.count}
                total={totalForBar}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ── Manager Dashboard ──────────────────────────────────────────────── */

function ManagerDashboard({ data }: { data: Extract<DashboardData, { role: 'manager' }> }) {
  const { stats } = data;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Team Size"
        value={String(stats.teamSize)}
        change=""
        changeLabel="direct reports"
        trend="neutral"
        icon={Users}
        accentColor="bg-blue-light text-blue"
      />
      <StatCard
        title="Pending Leave Approvals"
        value={String(stats.pendingLeaves)}
        change=""
        changeLabel="awaiting your review"
        trend={stats.pendingLeaves > 0 ? 'up' : 'neutral'}
        icon={ClipboardCheck}
        accentColor="bg-warning-light text-warning"
      />
      <StatCard
        title="On Leave Today"
        value={String(stats.onLeaveToday)}
        change=""
        changeLabel="team members"
        trend="neutral"
        icon={CalendarOff}
        accentColor="bg-error-light text-error"
      />
      <StatCard
        title="Pending Reviews"
        value={String(stats.pendingReviews)}
        change=""
        changeLabel="to complete"
        trend={stats.pendingReviews > 0 ? 'up' : 'neutral'}
        icon={Star}
        accentColor="bg-success-light text-success"
      />
    </section>
  );
}

/* ── Employee Dashboard ─────────────────────────────────────────────── */

function EmployeeDashboard({ data }: { data: Extract<DashboardData, { role: 'employee' }> }) {
  const { stats } = data;

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Pending Reviews"
          value={String(stats.pendingReviews)}
          change=""
          changeLabel="to complete"
          trend={stats.pendingReviews > 0 ? 'up' : 'neutral'}
          icon={Star}
          accentColor="bg-warning-light text-warning"
        />
        <StatCard
          title="Upcoming Leaves"
          value={String(stats.upcomingLeaves)}
          change=""
          changeLabel="approved"
          trend="neutral"
          icon={Calendar}
          accentColor="bg-blue-light text-blue"
        />
        <StatCard
          title="Leave Balance"
          value={stats.leaveBalance.length > 0
            ? String(stats.leaveBalance.reduce((s, l) => s + l.remaining, 0))
            : '0'}
          change=""
          changeLabel="days remaining total"
          trend="neutral"
          icon={CalendarOff}
          accentColor="bg-success-light text-success"
        />
      </section>

      {/* Leave Balance Breakdown */}
      {stats.leaveBalance.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-heading text-base text-card-foreground">
            Leave Balance
          </h3>
          <div className="space-y-3">
            {stats.leaveBalance.map((lb) => (
              <div key={lb.type} className="flex items-center gap-3">
                <span className="w-28 text-sm text-muted-foreground">{lb.type}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-blue transition-all"
                    style={{ width: `${lb.total > 0 ? (lb.used / lb.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {lb.used}/{lb.total}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ── Shared components ──────────────────────────────────────────────── */

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  accentColor: string;
}

function StatCard({ title, value, change, changeLabel, trend, icon: Icon, accentColor }: StatCardProps) {
  return (
    <div className="stat-card-accent rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 font-heading text-3xl text-card-foreground">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2.5', accentColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        {trend === 'up' && change && <TrendingUp className="h-3.5 w-3.5 text-success" />}
        {trend === 'down' && change && <TrendingDown className="h-3.5 w-3.5 text-blue" />}
        {change && (
          <span className={cn(
            'font-semibold',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-blue',
            trend === 'neutral' && 'text-muted-foreground',
          )}>
            {change}
          </span>
        )}
        <span className="text-muted-foreground">{changeLabel}</span>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-blue/30 hover:bg-blue-light hover:text-blue"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function DepartmentBar({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-muted-foreground">{name}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-foreground">{count}</span>
    </div>
  );
}
