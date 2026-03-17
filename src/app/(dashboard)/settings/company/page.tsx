'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/use-company-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Mumbai',
  'UTC',
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function CompanySettingsPage() {
  const { data: settingsData, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ein, setEin] = useState('');
  const [gstIn, setGstIn] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [fiscalYearStart, setFiscalYearStart] = useState('1');
  const [primaryColor, setPrimaryColor] = useState('#4B9EFF');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCountry, setAddressCountry] = useState('');

  useEffect(() => {
    if (settingsData?.data) {
      const c = settingsData.data;
      setName(c.name || '');
      setLegalName(c.legalName || '');
      setEin(c.ein || '');
      setGstIn(c.gstIn || '');
      setTimezone(c.timezone || 'America/New_York');
      setFiscalYearStart(String(c.fiscalYearStart || 1));
      setPrimaryColor(c.primaryColor || '#4B9EFF');
      const addr = c.address || {};
      setAddressLine1(addr.line1 || '');
      setAddressCity(addr.city || '');
      setAddressState(addr.state || '');
      setAddressZip(addr.zip || '');
      setAddressCountry(addr.country || '');
    }
  }, [settingsData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync({
        name,
        legalName: legalName || null,
        ein: ein || null,
        gstIn: gstIn || null,
        timezone,
        fiscalYearStart: Number(fiscalYearStart),
        primaryColor,
        address: {
          line1: addressLine1,
          city: addressCity,
          state: addressState,
          zip: addressZip,
          country: addressCountry,
        },
      });
      toast.success('Company settings updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settings');
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Company Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your company profile and configuration
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Company Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Company Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Legal Name</label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">EIN (US)</label>
              <Input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">GSTIN (India)</label>
              <Input value={gstIn} onChange={(e) => setGstIn(e.target.value)} placeholder="22AAAAA0000A1Z5" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Address</h2>
          <div>
            <label className="mb-1 block text-sm font-medium">Street Address</label>
            <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <Input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">State</label>
              <Input value={addressState} onChange={(e) => setAddressState(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ZIP Code</label>
              <Input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Country</label>
            <Input value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} />
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Configuration</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Timezone</label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fiscal Year Starts</label>
              <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Brand Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-28" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
