'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Info, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaveTypeInfo {
  id: string;
  name: string;
  leaveType: string;
  daysAllowed: number;
  isPaid: boolean;
  carryForward: boolean;
}

interface BalanceRecord {
  id: string;
  leaveTypeId: string;
  leaveType: LeaveTypeInfo;
  entitled: number;
  used: number;
  pending: number;
  carried: number;
  available: number;
}

interface BalanceResponse {
  data: BalanceRecord[];
  year: number;
}

// Friendly display names for leave type codes
const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
  CASUAL: 'Casual Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  BEREAVEMENT: 'Bereavement Leave',
  COMPENSATORY: 'Compensatory Off',
  UNPAID: 'Unpaid Leave',
  FMLA: 'FMLA',
  PL: 'Privilege Leave',
  EL: 'Earned Leave',
};

// Map leave types to their typical region
// US-specific: ANNUAL, SICK, FMLA, BEREAVEMENT, PATERNITY, MATERNITY, UNPAID
// India-specific: CASUAL, EL, PL, COMPENSATORY
// Shared: SICK (both regions may have it)
const REGION_MAP: Record<string, 'US' | 'INDIA' | 'ALL'> = {
  ANNUAL: 'US',
  SICK: 'ALL',
  CASUAL: 'INDIA',
  MATERNITY: 'ALL',
  PATERNITY: 'ALL',
  BEREAVEMENT: 'US',
  COMPENSATORY: 'INDIA',
  UNPAID: 'ALL',
  FMLA: 'US',
  PL: 'INDIA',
  EL: 'INDIA',
};

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function PoliciesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy Table Component
// ---------------------------------------------------------------------------

interface PolicyRow {
  id: string;
  name: string;
  code: string;
  daysAllowed: number;
  carryForward: boolean;
  isPaid: boolean;
  region: 'US' | 'INDIA' | 'ALL';
}

function PolicyTable({ policies }: { policies: PolicyRow[] }) {
  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#0B0F1A]/15 bg-white py-12">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No policies found for this region
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#0B0F1A]/10 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#0B0F1A]/10 bg-[#0B0F1A]/[0.02]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Leave Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Code
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Days Allowed
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Carry Forward
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paid
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Region
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#0B0F1A]/5">
          {policies.map((policy) => (
            <tr
              key={policy.id}
              className="transition-colors hover:bg-[#0B0F1A]/[0.01]"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {policy.name}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="font-mono text-xs">
                  {policy.code}
                </Badge>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-foreground">
                {policy.daysAllowed}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={policy.carryForward ? 'success' : 'destructive'}>
                  {policy.carryForward ? 'Yes' : 'No'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={policy.isPaid ? 'success' : 'warning'}>
                  {policy.isPaid ? 'Yes' : 'No'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant="secondary">
                  {policy.region === 'ALL' ? 'Global' : policy.region}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function LeavePoliciesPage() {
  // Fetch leave balance data which includes leaveType config
  const { data: balanceData, isLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => apiClient.get<BalanceResponse>('/api/leave/balance'),
  });

  // ---------------------------------------------------------------------------
  // Deduplicate and transform leave types into policy rows
  // ---------------------------------------------------------------------------

  const policies = useMemo<PolicyRow[]>(() => {
    if (!balanceData?.data) return [];

    const seen = new Map<string, PolicyRow>();

    for (const balance of balanceData.data) {
      const lt = balance.leaveType;
      if (!lt || seen.has(lt.id)) continue;

      seen.set(lt.id, {
        id: lt.id,
        name: lt.name || LEAVE_TYPE_LABELS[lt.leaveType] || lt.leaveType,
        code: lt.leaveType,
        daysAllowed: lt.daysAllowed,
        carryForward: lt.carryForward,
        isPaid: lt.isPaid,
        region: REGION_MAP[lt.leaveType] || 'ALL',
      });
    }

    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [balanceData]);

  // ---------------------------------------------------------------------------
  // Filter policies by region for tabs
  // ---------------------------------------------------------------------------

  const usPolicies = useMemo(
    () => policies.filter((p) => p.region === 'US' || p.region === 'ALL'),
    [policies]
  );

  const indiaPolicies = useMemo(
    () => policies.filter((p) => p.region === 'INDIA' || p.region === 'ALL'),
    [policies]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <PoliciesSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-[#4B9EFF]" />
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Leave Policies
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Overview of leave entitlements, carry-forward rules, and paid/unpaid
          classifications applicable to your organization.
        </p>
      </div>

      {/* Tabs for region filtering */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All Policies
          </TabsTrigger>
          <TabsTrigger value="us">
            US Policies
          </TabsTrigger>
          <TabsTrigger value="india">
            India Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PolicyTable policies={policies} />
        </TabsContent>

        <TabsContent value="us">
          <PolicyTable policies={usPolicies} />
        </TabsContent>

        <TabsContent value="india">
          <PolicyTable policies={indiaPolicies} />
        </TabsContent>
      </Tabs>

      {/* Summary stats */}
      {policies.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#0B0F1A]/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Leave Types
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {policies.length}
            </p>
          </div>
          <div className="rounded-lg border border-[#0B0F1A]/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paid Leave Types
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {policies.filter((p) => p.isPaid).length}
            </p>
          </div>
          <div className="rounded-lg border border-[#0B0F1A]/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              With Carry Forward
            </p>
            <p className="mt-1 text-2xl font-bold text-[#4B9EFF]">
              {policies.filter((p) => p.carryForward).length}
            </p>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-2 rounded-lg border border-[#4B9EFF]/20 bg-[#4B9EFF]/[0.04] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4B9EFF]" />
        <p className="text-xs text-muted-foreground">
          Contact HR to request policy changes. Leave entitlements are subject to
          regional labor law compliance (US: NJ labor law, FMLA; India:
          PF/Gratuity/TDS regulations).
        </p>
      </div>
    </div>
  );
}
