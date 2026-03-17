'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Clock, Users, Play, Loader2 } from 'lucide-react';
import { useReviewCycleDetail, useUpdateReviewCycle } from '@/hooks/use-performance';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'outline' | 'secondary' | 'destructive' }> = {
  NOT_STARTED: { label: 'Not Started', variant: 'outline' },
  SELF_REVIEW: { label: 'Self Review', variant: 'secondary' },
  PEER_REVIEW: { label: 'Peer Review', variant: 'secondary' },
  MANAGER_REVIEW: { label: 'Manager Review', variant: 'warning' },
  HR_REVIEW: { label: 'HR Review', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
};

export default function ReviewCyclePage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = use(params);
  const { data: cycleData, isLoading } = useReviewCycleDetail(cycleId);
  const updateCycle = useUpdateReviewCycle(cycleId);
  const { can } = usePermission();

  const cycle = cycleData?.data;
  const reviews = cycle?.reviews ?? [];

  const stats = useMemo(() => {
    if (reviews.length === 0) return { total: 0, completed: 0, pending: 0, notStarted: 0 };
    return {
      total: reviews.length,
      completed: reviews.filter((r: any) => r.status === 'COMPLETED').length,
      pending: reviews.filter((r: any) => !['NOT_STARTED', 'COMPLETED'].includes(r.status)).length,
      notStarted: reviews.filter((r: any) => r.status === 'NOT_STARTED').length,
    };
  }, [reviews]);

  async function handleActivate() {
    try {
      await updateCycle.mutateAsync({ isActive: true });
      toast.success('Cycle activated — reviews created for all employees');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate cycle');
    }
  }

  async function handleComplete() {
    try {
      await updateCycle.mutateAsync({ isActive: false });
      toast.success('Cycle marked as completed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to complete cycle');
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="mx-auto max-w-7xl rounded-lg border p-12 text-center">
        <h3 className="text-lg font-medium">Cycle not found</h3>
        <Link href="/performance" className="mt-4 inline-block">
          <Button variant="outline">Back to Performance</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/performance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
                {cycle.name}
              </h1>
              <Badge variant={cycle.isActive ? 'success' : 'outline'}>
                {cycle.isActive ? 'Active' : 'Completed'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(cycle.startDate), 'MMM d')} — {format(new Date(cycle.endDate), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        {can('performance:manage_cycles') && (
          <div className="flex gap-2">
            {!cycle.isActive && reviews.length === 0 && (
              <Button onClick={handleActivate} disabled={updateCycle.isPending}>
                {updateCycle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Play className="mr-2 h-4 w-4" />
                Activate
              </Button>
            )}
            {cycle.isActive && (
              <Button variant="outline" onClick={handleComplete} disabled={updateCycle.isPending}>
                {updateCycle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Cycle
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Total Reviews
          </div>
          <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </div>
          <div className="mt-1 text-2xl font-semibold text-green-600">{stats.completed}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            In Progress
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-600">{stats.pending}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Not Started</div>
          <div className="mt-1 text-2xl font-semibold text-muted-foreground">{stats.notStarted}</div>
        </div>
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Completion</span>
            <span>{Math.round((stats.completed / stats.total) * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Deadlines */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Self Review Deadline</div>
          <div className="mt-0.5 text-sm font-medium">{format(new Date(cycle.selfReviewDeadline), 'MMM d, yyyy')}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Peer Review Deadline</div>
          <div className="mt-0.5 text-sm font-medium">{format(new Date(cycle.peerReviewDeadline), 'MMM d, yyyy')}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Manager Review Deadline</div>
          <div className="mt-0.5 text-sm font-medium">{format(new Date(cycle.managerReviewDeadline), 'MMM d, yyyy')}</div>
        </div>
      </div>

      {/* Reviews Table */}
      {reviews.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-3">Employee</th>
                <th className="p-3">Reviewer</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review: any) => {
                const sb = STATUS_BADGE[review.status] ?? { label: review.status, variant: 'outline' as const };
                return (
                  <tr key={review.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {review.subject
                        ? `${review.subject.firstName} ${review.subject.lastName}`
                        : review.subjectId}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {review.reviewer
                        ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
                        : review.reviewerId}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{review.type}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </td>
                    <td className="p-3">
                      {review.overallRating ? `${review.overallRating.toFixed(1)}/5` : '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {review.submittedAt
                        ? format(new Date(review.submittedAt), 'MMM d, yyyy')
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No reviews yet. Activate the cycle to create reviews for all employees.
        </div>
      )}
    </div>
  );
}
