'use client';

import Link from 'next/link';
import {
  Users,
  CalendarOff,
  DollarSign,
  TrendingDown,
  Shield,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportCard {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

const REPORT_CARDS: ReportCard[] = [
  {
    type: 'headcount',
    title: 'Headcount',
    description:
      'Employee distribution by department, role, and region. View active workforce composition and employment type breakdown.',
    icon: <Users className="h-6 w-6" />,
  },
  {
    type: 'leave',
    title: 'Leave',
    description:
      'Leave utilization and patterns across the organization. Track approval rates, leave types, and department trends.',
    icon: <CalendarOff className="h-6 w-6" />,
  },
  {
    type: 'payroll',
    title: 'Payroll',
    description:
      'Payroll summaries by period and region. Monitor gross pay, net pay, and tax deductions across payroll runs.',
    icon: <DollarSign className="h-6 w-6" />,
    badge: 'Finance',
  },
  {
    type: 'turnover',
    title: 'Turnover',
    description:
      'Employee joins and exits over time. Calculate turnover rates and identify retention patterns by department.',
    icon: <TrendingDown className="h-6 w-6" />,
  },
  {
    type: 'compliance',
    title: 'Compliance',
    description:
      'Expiring documents, missing compliance items, and pending confirmations. Proactively address regulatory gaps.',
    icon: <Shield className="h-6 w-6" />,
    badge: 'Action Required',
  },
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
          Reports
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access comprehensive HR analytics and reports. Generate insights on
          headcount, turnover, compensation benchmarks, diversity metrics, and
          workforce planning data.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((report) => (
          <Link
            key={report.type}
            href={`/reports/${report.type}`}
            className="group"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-[#4B9EFF]/10 p-2.5 text-[#4B9EFF]">
                    {report.icon}
                  </div>
                  {report.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {report.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-4 text-lg">{report.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  className="group-hover:text-[#4B9EFF]"
                >
                  View Report
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
