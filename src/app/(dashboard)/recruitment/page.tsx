'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Briefcase, Users, UserCheck, Clock } from 'lucide-react';
import { useJobs, useCandidates } from '@/hooks/use-recruitment';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RecruitmentPage() {
  const { data: jobsData, isLoading: jobsLoading } = useJobs({ pageSize: '100' });
  const { data: candidatesData, isLoading: candidatesLoading } = useCandidates({ pageSize: '100' });

  const isLoading = jobsLoading || candidatesLoading;

  const stats = useMemo(() => {
    const jobs = jobsData?.data ?? [];
    const candidates = candidatesData?.data ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      openPositions: jobs.filter((j) => j.status === 'OPEN').length,
      activeCandidates: candidates.filter(
        (c) => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(c.stage)
      ).length,
      hiresThisMonth: candidates.filter(
        (c) => c.stage === 'HIRED' && c.hiredAt && new Date(c.hiredAt) >= monthStart
      ).length,
      totalJobs: jobs.length,
    };
  }, [jobsData, candidatesData]);

  const recentCandidates = useMemo(() => {
    return (candidatesData?.data ?? []).slice(0, 8);
  }, [candidatesData]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Recruitment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your hiring pipeline from job posting to offer
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/recruitment/pipeline">
            <Button variant="outline">Pipeline</Button>
          </Link>
          <Link href="/recruitment/candidates">
            <Button variant="outline">Candidates</Button>
          </Link>
          <Link href="/recruitment/jobs">
            <Button>Job Postings</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Open Positions
            </div>
            <div className="mt-1 text-2xl font-semibold">{stats.openPositions}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Active Candidates
            </div>
            <div className="mt-1 text-2xl font-semibold">{stats.activeCandidates}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              Hires This Month
            </div>
            <div className="mt-1 text-2xl font-semibold text-green-600">{stats.hiresThisMonth}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Total Jobs
            </div>
            <div className="mt-1 text-2xl font-semibold">{stats.totalJobs}</div>
          </div>
        </div>
      )}

      {/* Recent Candidates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Candidates</h2>
          <Link href="/recruitment/candidates">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recentCandidates.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No candidates yet. Post a job to start receiving applications.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Name</th>
                  <th className="p-3">Job</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {recentCandidates.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.job?.title ?? '-'}</td>
                    <td className="p-3">
                      <StageBadge stage={c.stage} />
                    </td>
                    <td className="p-3 text-muted-foreground">{c.source ?? '-'}</td>
                    <td className="p-3 text-muted-foreground">{c.rating ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const STAGE_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  APPLIED: { label: 'Applied', variant: 'outline' },
  SCREENING: { label: 'Screening', variant: 'secondary' },
  PHONE_INTERVIEW: { label: 'Phone', variant: 'secondary' },
  TECHNICAL: { label: 'Technical', variant: 'secondary' },
  FINAL_INTERVIEW: { label: 'Final', variant: 'warning' },
  OFFER_SENT: { label: 'Offer Sent', variant: 'warning' },
  OFFER_ACCEPTED: { label: 'Accepted', variant: 'success' },
  HIRED: { label: 'Hired', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'destructive' },
};

function StageBadge({ stage }: { stage: string }) {
  const sc = STAGE_CONFIG[stage] ?? { label: stage, variant: 'outline' as const };
  return <Badge variant={sc.variant}>{sc.label}</Badge>;
}
