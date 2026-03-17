'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Route label mapping ─────────────────────────────────────────────── */

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  employees: 'Employees',
  new: 'Add New',
  edit: 'Edit',
  onboarding: 'Onboarding',
  leave: 'Leave',
  apply: 'Apply',
  calendar: 'Calendar',
  policies: 'Policies',
  attendance: 'Attendance',
  reports: 'Reports',
  payroll: 'Payroll',
  run: 'Run Payroll',
  history: 'History',
  performance: 'Performance',
  reviews: 'Reviews',
  goals: 'Goals',
  recruitment: 'Recruitment',
  jobs: 'Job Postings',
  candidates: 'Candidates',
  pipeline: 'Pipeline',
  documents: 'Documents',
  templates: 'Templates',
  'org-chart': 'Org Chart',
  settings: 'Settings',
  company: 'Company',
  roles: 'Roles & Permissions',
  integrations: 'Integrations',
  compliance: 'Compliance',
  'ai-assistant': 'AI Assistant',
};

/* ── Breadcrumbs component ───────────────────────────────────────────── */

interface BreadcrumbsProps {
  className?: string;
}

export function Breadcrumbs({ className }: BreadcrumbsProps) {
  const pathname = usePathname();

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);

    const crumbs = [
      { label: 'Dashboard', href: '/', isCurrent: parts.length === 0 },
    ];

    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      accumulated += `/${segment}`;
      const isCurrent = i === parts.length - 1;

      /* Dynamic segments (UUIDs / IDs) get a generic label */
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segment
        );
      const isNumericId = /^\d+$/.test(segment);
      const isDynamic = isUuid || isNumericId;

      const label = isDynamic
        ? 'Detail'
        : ROUTE_LABELS[segment] ?? formatSegment(segment);

      crumbs.push({ label, href: accumulated, isCurrent });
    }

    return crumbs;
  }, [pathname]);

  /* Don't render if we're on the root dashboard */
  if (segments.length <= 1) {
    return (
      <div className={cn('flex items-center', className)}>
        <h1 className="font-heading text-lg text-foreground">Dashboard</h1>
      </div>
    );
  }

  const currentPage = segments[segments.length - 1];

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {/* Page title */}
      <h1 className="font-heading text-lg leading-tight text-foreground">
        {currentPage.label}
      </h1>

      {/* Breadcrumb trail */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          {segments.map((segment, index) => (
            <li key={segment.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
              )}
              {index === 0 && (
                <Home className="mr-0.5 h-3 w-3" aria-hidden="true" />
              )}
              {segment.isCurrent ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {segment.label}
                </span>
              ) : (
                <Link
                  href={segment.href}
                  className="focus-ring rounded transition-colors hover:text-foreground"
                >
                  {segment.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default Breadcrumbs;
