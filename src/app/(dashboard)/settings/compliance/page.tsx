'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, IndianRupee, DollarSign } from 'lucide-react';
import { useCompanySettings } from '@/hooks/use-company-settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const INDIA_MODULES = [
  {
    id: 'pf',
    name: 'Provident Fund (PF)',
    description: 'EPF contribution at 12% of basic salary for eligible employees',
  },
  {
    id: 'esi',
    name: 'Employee State Insurance (ESI)',
    description: 'ESI at 0.75% for employees with gross salary up to INR 21,000/month',
  },
  {
    id: 'professional_tax',
    name: 'Professional Tax',
    description: 'State-level professional tax deduction (varies by state)',
  },
  {
    id: 'tds',
    name: 'Tax Deducted at Source (TDS)',
    description: 'Income tax deduction as per IT slabs (Old/New regime)',
  },
  {
    id: 'gratuity',
    name: 'Gratuity',
    description: 'Gratuity provision for employees with 5+ years of service',
  },
  {
    id: 'maternity',
    name: 'Maternity Leave',
    description: '26 weeks maternity leave as per Maternity Benefit Act',
  },
];

const US_MODULES = [
  {
    id: 'fmla',
    name: 'FMLA',
    description: 'Family and Medical Leave Act — 12 weeks unpaid leave after 12 months',
  },
  {
    id: 'nj_sick_leave',
    name: 'NJ Earned Sick Leave',
    description: '1 hour per 30 hours worked, up to 40 hours annually',
  },
  {
    id: 'social_security',
    name: 'Social Security (FICA)',
    description: '6.2% employer + 6.2% employee contribution',
  },
  {
    id: 'medicare',
    name: 'Medicare',
    description: '1.45% employer + 1.45% employee (+ 0.9% additional over $200K)',
  },
  {
    id: 'eeo1',
    name: 'EEO-1 Reporting',
    description: 'Annual demographic workforce data reporting (100+ employees)',
    optional: true,
  },
  {
    id: 'i9_verification',
    name: 'I-9 Verification',
    description: 'Employment eligibility verification within 3 business days of hire',
  },
];

export default function ComplianceSettingsPage() {
  const { isLoading } = useCompanySettings();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Compliance Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Region-specific compliance modules and statutory requirements
          </p>
        </div>
      </div>

      {/* India */}
      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950">
            <IndianRupee className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">India Compliance</h2>
            <p className="text-sm text-muted-foreground">Statutory requirements for India region</p>
          </div>
        </div>
        <div className="space-y-3">
          {INDIA_MODULES.map((mod) => (
            <div key={mod.id} className="flex items-start justify-between rounded-md border p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{mod.name}</span>
                  <Badge variant="outline">Statutory</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{mod.description}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* US */}
      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">US Compliance (NJ)</h2>
            <p className="text-sm text-muted-foreground">Federal and New Jersey state requirements</p>
          </div>
        </div>
        <div className="space-y-3">
          {US_MODULES.map((mod) => (
            <div key={mod.id} className="flex items-start justify-between rounded-md border p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{mod.name}</span>
                  <Badge variant="outline">{(mod as any).optional ? 'Optional' : 'Statutory'}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{mod.description}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Shield className="mb-1 inline h-4 w-4" /> Statutory compliance modules cannot be disabled.
        Tax rates and contribution percentages follow the latest statutory defaults and are automatically
        applied during payroll calculations.
      </div>
    </div>
  );
}
