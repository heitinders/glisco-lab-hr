'use client';

import { useState, useMemo, useCallback, type DragEvent } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Star, FileText, GripVertical } from 'lucide-react';
import { useCandidates, useUpdateCandidateStage, type CandidateRecord } from '@/hooks/use-recruitment';
import { useJobs } from '@/hooks/use-recruitment';
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

const PIPELINE_STAGES = [
  { key: 'APPLIED', label: 'Applied', color: 'bg-slate-100 dark:bg-slate-800' },
  { key: 'SCREENING', label: 'Screening', color: 'bg-blue-50 dark:bg-blue-950' },
  { key: 'PHONE_INTERVIEW', label: 'Phone', color: 'bg-indigo-50 dark:bg-indigo-950' },
  { key: 'TECHNICAL', label: 'Technical', color: 'bg-violet-50 dark:bg-violet-950' },
  { key: 'FINAL_INTERVIEW', label: 'Final', color: 'bg-amber-50 dark:bg-amber-950' },
  { key: 'OFFER_SENT', label: 'Offer Sent', color: 'bg-orange-50 dark:bg-orange-950' },
  { key: 'HIRED', label: 'Hired', color: 'bg-green-50 dark:bg-green-950' },
] as const;

export default function PipelinePage() {
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const { data: jobsData } = useJobs({ pageSize: '100', status: 'OPEN' });
  const { data: candidatesData, isLoading } = useCandidates({
    pageSize: '200',
    ...(jobFilter !== 'all' && { jobId: jobFilter }),
  });

  const jobs = jobsData?.data ?? [];
  const candidates = candidatesData?.data ?? [];

  const grouped = useMemo(() => {
    const map: Record<string, CandidateRecord[]> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage.key] = [];
    }
    for (const c of candidates) {
      if (map[c.stage]) {
        map[c.stage].push(c);
      }
    }
    return map;
  }, [candidates]);

  function handleDragStart(e: DragEvent, candidateId: string) {
    e.dataTransfer.setData('candidateId', candidateId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent, stage: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  async function handleDrop(e: DragEvent, targetStage: string) {
    e.preventDefault();
    setDragOverStage(null);
    const candidateId = e.dataTransfer.getData('candidateId');
    if (!candidateId) return;

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage === targetStage) return;

    setMovingId(candidateId);
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to move candidate');
      }
      toast.success(`Moved to ${PIPELINE_STAGES.find((s) => s.key === targetStage)?.label ?? targetStage}`);
      // Refetch via query invalidation
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move candidate');
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/recruitment">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
              Pipeline
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag candidates between stages to move them through the pipeline
            </p>
          </div>
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Open Jobs</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid auto-cols-[minmax(180px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = grouped[stage.key] ?? [];
            const isDragOver = dragOverStage === stage.key;

            return (
              <div
                key={stage.key}
                className={`flex min-h-[400px] flex-col rounded-lg border-2 transition-colors ${
                  isDragOver ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'border-transparent bg-muted/30'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                {/* Column Header */}
                <div className={`rounded-t-lg px-3 py-2 ${stage.color}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {stage.label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {stageCandidates.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 p-2">
                  {stageCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      isMoving={movingId === c.id}
                      onDragStart={(e) => handleDragStart(e, c.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejected / Withdrawn counts */}
      {!isLoading && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            Rejected: {candidates.filter((c) => c.stage === 'REJECTED').length}
          </span>
          <span>
            Withdrawn: {candidates.filter((c) => c.stage === 'WITHDRAWN').length}
          </span>
          <span>
            Total: {candidates.length}
          </span>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  isMoving,
  onDragStart,
}: {
  candidate: CandidateRecord;
  isMoving: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`cursor-grab rounded-md border bg-background p-3 shadow-sm transition-opacity active:cursor-grabbing ${
        isMoving ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {candidate.firstName} {candidate.lastName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {candidate.job?.title ?? ''}
          </div>
        </div>
        <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {candidate.rating && (
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {candidate.rating}
          </div>
        )}
        {candidate.source && (
          <span className="text-[10px] text-muted-foreground">{candidate.source}</span>
        )}
        {candidate.resumeUrl && (
          <FileText className="h-3 w-3 text-muted-foreground/60" />
        )}
      </div>
      {candidate.aiAssessment && (
        <div className="mt-2 rounded bg-blue-50 p-1.5 text-[10px] leading-tight text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          AI: {candidate.aiAssessment.slice(0, 80)}...
        </div>
      )}
    </div>
  );
}
