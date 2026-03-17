'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  BarChart3,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { useReviewCycles, useCreateReviewCycle } from '@/hooks/use-performance';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

export default function PerformancePage() {
  const { can } = usePermission();
  const { data: cyclesData, isLoading } = useReviewCycles();
  const createCycle = useCreateReviewCycle();
  const [showCreate, setShowCreate] = useState(false);

  const cycles = useMemo(() => {
    if (!cyclesData) return [];
    return cyclesData.data ?? [];
  }, [cyclesData]);

  const activeCycles = cycles.filter((c: any) => c.isActive);
  const pastCycles = cycles.filter((c: any) => !c.isActive);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Performance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage review cycles, track goals, and monitor team performance
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/performance/reviews">
            <Button variant="outline">My Reviews</Button>
          </Link>
          <Link href="/performance/goals">
            <Button variant="outline">Goals</Button>
          </Link>
          {can('performance:manage_cycles') && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Button>
          )}
        </div>
      </div>

      {/* Create Cycle Form */}
      {showCreate && (
        <CreateCycleForm
          onCreated={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Active Cycles */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          {activeCycles.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Active Cycles</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCycles.map((cycle: any) => (
                  <CycleCard key={cycle.id} cycle={cycle} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {activeCycles.length > 0 ? 'Past Cycles' : 'All Cycles'}
            </h2>
            {cycles.length === 0 ? (
              <div className="rounded-lg border p-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No review cycles</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first review cycle to get started.
                </p>
              </div>
            ) : pastCycles.length === 0 && activeCycles.length > 0 ? (
              <p className="text-sm text-muted-foreground">No past cycles yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="p-3">Cycle Name</th>
                      <th className="p-3">Period</th>
                      <th className="p-3">Reviews</th>
                      <th className="p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeCycles.length > 0 ? pastCycles : cycles).map((cycle: any) => (
                      <tr key={cycle.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{cycle.name}</td>
                        <td className="p-3 text-muted-foreground">
                          {format(new Date(cycle.startDate), 'MMM d')} — {format(new Date(cycle.endDate), 'MMM d, yyyy')}
                        </td>
                        <td className="p-3 text-muted-foreground">{cycle._count?.reviews ?? 0}</td>
                        <td className="p-3">
                          <Badge variant={cycle.isActive ? 'success' : 'outline'}>
                            {cycle.isActive ? 'Active' : 'Completed'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Link href={`/performance/${cycle.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CycleCard({ cycle }: { cycle: any }) {
  const totalReviews = cycle._count?.reviews ?? 0;

  return (
    <Link href={`/performance/${cycle.id}`}>
      <div className="rounded-lg border p-5 transition-colors hover:bg-muted/30">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{cycle.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(cycle.startDate), 'MMM d')} — {format(new Date(cycle.endDate), 'MMM d, yyyy')}
            </p>
          </div>
          <Badge variant="success">Active</Badge>
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {totalReviews} reviews
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Self review: {format(new Date(cycle.selfReviewDeadline), 'MMM d')}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CreateCycleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const createCycle = useCreateReviewCycle();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selfDeadline, setSelfDeadline] = useState('');
  const [peerDeadline, setPeerDeadline] = useState('');
  const [managerDeadline, setManagerDeadline] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCycle.mutateAsync({
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        selfReviewDeadline: new Date(selfDeadline).toISOString(),
        peerReviewDeadline: new Date(peerDeadline).toISOString(),
        managerReviewDeadline: new Date(managerDeadline).toISOString(),
      });
      toast.success('Review cycle created');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create cycle');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
      <h3 className="font-semibold text-foreground">New Review Cycle</h3>
      <div>
        <label className="mb-1 block text-sm font-medium">Cycle Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 2026 Review" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Self Review Deadline</label>
          <Input type="date" value={selfDeadline} onChange={(e) => setSelfDeadline(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Peer Review Deadline</label>
          <Input type="date" value={peerDeadline} onChange={(e) => setPeerDeadline(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Manager Review Deadline</label>
          <Input type="date" value={managerDeadline} onChange={(e) => setManagerDeadline(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={createCycle.isPending}>
          {createCycle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Cycle
        </Button>
      </div>
    </form>
  );
}
