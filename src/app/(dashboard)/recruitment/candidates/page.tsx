'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Users, Search } from 'lucide-react';
import { useCandidates } from '@/hooks/use-recruitment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STAGE_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  APPLIED: { label: 'Applied', variant: 'outline' },
  SCREENING: { label: 'Screening', variant: 'secondary' },
  PHONE_INTERVIEW: { label: 'Phone Interview', variant: 'secondary' },
  TECHNICAL: { label: 'Technical', variant: 'secondary' },
  FINAL_INTERVIEW: { label: 'Final Interview', variant: 'warning' },
  OFFER_SENT: { label: 'Offer Sent', variant: 'warning' },
  OFFER_ACCEPTED: { label: 'Accepted', variant: 'success' },
  HIRED: { label: 'Hired', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'destructive' },
};

export default function CandidatesPage() {
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState('1');

  const { data: candidatesData, isLoading } = useCandidates({
    page,
    pageSize: '20',
    ...(stageFilter !== 'all' && { stage: stageFilter }),
    ...(sourceFilter !== 'all' && { source: sourceFilter }),
    ...(search && { search }),
  });

  const candidates = candidatesData?.data ?? [];
  const totalPages = candidatesData?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Candidates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage all candidate profiles
          </p>
        </div>
        <Link href="/recruitment/pipeline">
          <Button variant="outline">Pipeline View</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage('1'); }}
            placeholder="Search candidates..."
            className="w-[240px] pl-9"
          />
        </div>

        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage('1'); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="APPLIED">Applied</SelectItem>
            <SelectItem value="SCREENING">Screening</SelectItem>
            <SelectItem value="PHONE_INTERVIEW">Phone Interview</SelectItem>
            <SelectItem value="TECHNICAL">Technical</SelectItem>
            <SelectItem value="FINAL_INTERVIEW">Final Interview</SelectItem>
            <SelectItem value="OFFER_SENT">Offer Sent</SelectItem>
            <SelectItem value="OFFER_ACCEPTED">Accepted</SelectItem>
            <SelectItem value="HIRED">Hired</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage('1'); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
            <SelectItem value="INDEED">Indeed</SelectItem>
            <SelectItem value="REFERRAL">Referral</SelectItem>
            <SelectItem value="WEBSITE">Website</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No candidates found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting the filters or add candidates to a job posting.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Name</th>
                  <th className="p-3">Job</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Applied</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const stg = STAGE_CONFIG[c.stage] ?? { label: c.stage, variant: 'outline' as const };
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{c.job?.title ?? '-'}</td>
                      <td className="p-3">
                        <Badge variant={stg.variant}>{stg.label}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{c.source ?? '-'}</td>
                      <td className="p-3 text-muted-foreground">{c.rating ?? '-'}</td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(c.createdAt), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({candidatesData?.total ?? 0} candidates)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Number(page) <= 1}
                  onClick={() => setPage(String(Number(page) - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Number(page) >= totalPages}
                  onClick={() => setPage(String(Number(page) + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
