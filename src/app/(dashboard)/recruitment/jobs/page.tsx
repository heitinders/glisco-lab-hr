'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus,
  Briefcase,
  Loader2,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useJobs, useCreateJob, useDeleteJob } from '@/hooks/use-recruitment';
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

export default function JobPostingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState('1');

  const { data: jobsData, isLoading } = useJobs({
    page,
    pageSize: '20',
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(regionFilter !== 'all' && { region: regionFilter }),
  });

  const jobs = jobsData?.data ?? [];
  const totalPages = jobsData?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Job Postings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage job listings
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Job
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateJobForm
          onCreated={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage('1'); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="FILLED">Filled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setPage('1'); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            <SelectItem value="US">US</SelectItem>
            <SelectItem value="INDIA">India</SelectItem>
            <SelectItem value="REMOTE">Remote</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No jobs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a job posting to start recruiting.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3">Title</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Candidates</th>
                  <th className="p-3">Posted</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const sc = STATUS_CONFIG[job.status] ?? { label: job.status, variant: 'outline' as const };
                  return (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{job.title}</td>
                      <td className="p-3 text-muted-foreground">
                        {job.department?.name ?? '-'}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{job.region}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {job._count?.candidates ?? 0}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {job.postedAt
                          ? format(new Date(job.postedAt), 'MMM d, yyyy')
                          : '-'}
                      </td>
                      <td className="p-3">
                        <Link href={`/recruitment/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
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
                Page {page} of {totalPages}
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

function CreateJobForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const createJob = useCreateJob();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [region, setRegion] = useState('US');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [openings, setOpenings] = useState('1');
  const [closesAt, setClosesAt] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createJob.mutateAsync({
        title,
        description,
        requirements: requirements || undefined,
        employmentType,
        region,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        currency,
        openings: Number(openings),
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      });
      toast.success('Job posting created');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create job');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
      <h3 className="font-semibold text-foreground">New Job Posting</h3>
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Software Engineer" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={4}
          placeholder="Job description..."
          required
          minLength={10}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Requirements</label>
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={3}
          placeholder="Skills and qualifications..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Employment Type</label>
          <Select value={employmentType} onValueChange={setEmploymentType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_TIME">Full Time</SelectItem>
              <SelectItem value="PART_TIME">Part Time</SelectItem>
              <SelectItem value="CONTRACT">Contract</SelectItem>
              <SelectItem value="INTERN">Intern</SelectItem>
              <SelectItem value="CONSULTANT">Consultant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Region</label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="US">US</SelectItem>
              <SelectItem value="INDIA">India</SelectItem>
              <SelectItem value="REMOTE">Remote</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Openings</label>
          <Input type="number" value={openings} onChange={(e) => setOpenings(e.target.value)} min={1} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Salary Min</label>
          <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="50000" min={0} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Salary Max</label>
          <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="80000" min={0} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Currency</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="INR">INR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Application Deadline</label>
        <Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={createJob.isPending}>
          {createJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Job
        </Button>
      </div>
    </form>
  );
}
