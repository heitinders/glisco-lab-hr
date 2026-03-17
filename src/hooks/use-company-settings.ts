'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface CompanySettings {
  id: string;
  name: string;
  legalName: string | null;
  cin: string | null;
  ein: string | null;
  gstIn: string | null;
  address: any;
  logoUrl: string | null;
  primaryColor: string;
  fiscalYearStart: number;
  timezone: string;
  region: string;
  settings: any;
}

export function useCompanySettings() {
  return useQuery<{ data: CompanySettings }>({
    queryKey: ['company-settings'],
    queryFn: () => apiClient.get('/api/settings/company'),
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CompanySettings>) =>
      apiClient.patch('/api/settings/company', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-settings'] }),
  });
}
