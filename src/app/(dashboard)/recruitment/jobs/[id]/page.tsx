'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Users,
  Loader2,
  Plus,
  MapPin,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useJobDetail, useUpdateJob, useCreateCandidate, type JobRecord, type CandidateRecord } from '@/hooks/use-recruitment';
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  OPEN: { label: 'Open', variant: 'success' },
  ON_HOLD: { label: 'On Hold', variant: 'warning' },
  CLOSED: { label: 'Closed', variant: 'secondary' },
  FILLED: { label: 'Filled', variant: 'destructive' },
};

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

function formatCurrency(val: string | number | null, currency: string) {
  if (val == null) return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: jobData, isLoading } = useJobDetail(id);
  const updateJob = useUpdateJob(id);
  const [showAddCandidate, setShowAddCandidate] = useState(false);

  const job = jobData?.data;

  async function handleStatusChange(status: string) {
    try {
      await updateJob.mutateAsync({ status });
      toast.success(`Job status updated to ${STATUS_CONFIG[status]?.label ?? status}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
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
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-7xl rounded-lg border p-12 text-center">
        <h3 className="text-lg font-medium">Job not found</h3>
        <Link href="/recruitment/jobs" className="mt-4 inline-block">
          <Button variant="outline">Back to Jobs</Button>
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[job.status] ?? { label: job.status, variant: 'outline' as const };
  const candidates = job.candidates ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/recruitment/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
                {job.title}
              </h1>
              <Badge variant={sc.variant}>{sc.label}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {job.department?.name && (
                <span>{job.department.name}</span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.region}
              </span>
              <span>{job.employmentType.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === 'DRAFT' && (
            <Button onClick={() => handleStatusChange('OPEN')} disabled={updateJob.isPending}>
              {updateJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          )}
          {job.status === 'OPEN' && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange('ON_HOLD')} disabled={updateJob.isPending}>
                Hold
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange('CLOSED')} disabled={updateJob.isPending}>
                Close
              </Button>
            </>
          )}
          {job.status === 'ON_HOLD' && (
            <Button onClick={() => handleStatusChange('OPEN')} disabled={updateJob.isPending}>
              Reopen
            </Button>
          )}
          {job.status === 'CLOSED' && (
            <Button variant="outline" onClick={() => handleStatusChange('OPEN')} disabled={updateJob.isPending}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Candidates
          </div>
          <div className="mt-1 text-2xl font-semibold">{candidates.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Salary Range
          </div>
          <div className="mt-1 text-sm font-medium">
            {job.salaryMin || job.salaryMax
              ? `${formatCurrency(job.salaryMin, job.currency)} - ${formatCurrency(job.salaryMax, job.currency)}`
              : 'Not specified'}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Openings</div>
          <div className="mt-1 text-2xl font-semibold">{job.openings}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Posted
          </div>
          <div className="mt-1 text-sm font-medium">
            {job.postedAt ? format(new Date(job.postedAt), 'MMM d, yyyy') : 'Not yet'}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-2 font-semibold text-foreground">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.description}</p>
        {job.requirements && (
          <>
            <h2 className="mb-2 mt-4 font-semibold text-foreground">Requirements</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.requirements}</p>
          </>
        )}
      </div>

      {/* Candidates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Candidates</h2>
          {job.status === 'OPEN' && (
            <Button size="sm" onClick={() => setShowAddCandidate(true)}>
              <Plus className="mr-2 h-3 w-3" />
              Add Candidate
            </Button>
          )}
        </div>

        {showAddCandidate && (
          <AddCandidateForm
            jobId={job.id}
            onCreated={() => setShowAddCandidate(false)}
            onCancel={() => setShowAddCandidate(false)}
          />
        )}

        {candidates.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No candidates yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Applied</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c: CandidateRecord) => {
                  const stg = STAGE_CONFIG[c.stage] ?? { label: c.stage, variant: 'outline' as const };
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{c.firstName} {c.lastName}</td>
                      <td className="p-3 text-muted-foreground">{c.email}</td>
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
        )}
      </div>
    </div>
  );
}

function AddCandidateForm({
  jobId,
  onCreated,
  onCancel,
}: {
  jobId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const createCandidate = useCreateCandidate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCandidate.mutateAsync({
        jobId,
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        source: source || undefined,
        resumeUrl: resumeUrl || undefined,
      });
      toast.success('Candidate added');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add candidate');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border p-5 space-y-4">
      <h3 className="font-semibold text-foreground">Add Candidate</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">First Name</label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Last Name</label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="INDEED">Indeed</SelectItem>
              <SelectItem value="REFERRAL">Referral</SelectItem>
              <SelectItem value="WEBSITE">Website</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Resume URL</label>
          <Input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={createCandidate.isPending}>
          {createCandidate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Candidate
        </Button>
      </div>
    </form>
  );
}
