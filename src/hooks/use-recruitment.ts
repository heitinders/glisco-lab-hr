'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobFilters {
  page?: string;
  pageSize?: string;
  status?: string;
  departmentId?: string;
  region?: string;
}

interface CandidateFilters {
  page?: string;
  pageSize?: string;
  jobId?: string;
  stage?: string;
  source?: string;
  search?: string;
  sort?: string;
  order?: string;
}

export interface JobRecord {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements: string | null;
  designationId: string | null;
  departmentId: string | null;
  employmentType: string;
  region: string;
  salaryMin: string | number | null;
  salaryMax: string | number | null;
  currency: string;
  status: string;
  postedAt: string | null;
  closesAt: string | null;
  hiringManagerId: string | null;
  openings: number;
  createdAt: string;
  updatedAt: string;
  designation?: { title: string } | null;
  department?: { name: string } | null;
  _count?: { candidates: number };
  candidates?: CandidateRecord[];
}

export interface CandidateRecord {
  id: string;
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  coverLetterUrl: string | null;
  stage: string;
  source: string | null;
  referredById: string | null;
  rating: number | null;
  notes: string | null;
  tags: string[];
  scorecards: any[];
  aiAssessment: string | null;
  rejectedReason: string | null;
  offerSentAt: string | null;
  hiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { title: string; status: string };
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function useJobs(filters?: JobFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', filters.page);
  if (filters?.pageSize) params.set('pageSize', filters.pageSize);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.departmentId) params.set('departmentId', filters.departmentId);
  if (filters?.region) params.set('region', filters.region);
  const qs = params.toString();

  return useQuery<PaginatedResponse<JobRecord>>({
    queryKey: ['jobs', filters],
    queryFn: () => apiClient.get(`/api/recruitment/jobs${qs ? `?${qs}` : ''}`),
  });
}

export function useJobDetail(id: string | null) {
  return useQuery<{ data: JobRecord }>({
    queryKey: ['jobs', id],
    queryFn: () => apiClient.get(`/api/recruitment/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.post('/api/recruitment/jobs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.patch(`/api/recruitment/jobs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useDeleteJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/api/recruitment/jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export function useCandidates(filters?: CandidateFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', filters.page);
  if (filters?.pageSize) params.set('pageSize', filters.pageSize);
  if (filters?.jobId) params.set('jobId', filters.jobId);
  if (filters?.stage) params.set('stage', filters.stage);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.order) params.set('order', filters.order);
  const qs = params.toString();

  return useQuery<PaginatedResponse<CandidateRecord>>({
    queryKey: ['candidates', filters],
    queryFn: () => apiClient.get(`/api/recruitment/candidates${qs ? `?${qs}` : ''}`),
  });
}

export function useCandidateDetail(id: string | null) {
  return useQuery<{ data: CandidateRecord }>({
    queryKey: ['candidates', id],
    queryFn: () => apiClient.get(`/api/recruitment/candidates/${id}`),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.post('/api/recruitment/candidates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateCandidateStage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.patch(`/api/recruitment/candidates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeleteCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/api/recruitment/candidates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
