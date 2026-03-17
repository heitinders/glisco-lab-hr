'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  User,
  Briefcase,
} from 'lucide-react';
import { useEmployee } from '@/hooks/use-employees';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  ON_LEAVE: { label: 'On Leave', variant: 'warning' },
  NOTICE_PERIOD: { label: 'Notice Period', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'destructive' },
  OFFBOARDED: { label: 'Offboarded', variant: 'outline' },
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: employee, isLoading, error } = useEmployee(id);
  const { can } = usePermission();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-2xl text-foreground">Employee not found</h1>
        <Link href="/employees">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[employee.status] || { label: employee.status, variant: 'outline' as const };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/employees">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4B9EFF]/10 text-lg font-semibold text-[#4B9EFF]">
              {employee.firstName[0]}
              {employee.lastName[0]}
            </div>
            <div>
              <h1 className="font-heading text-2xl text-foreground">
                {employee.firstName} {employee.lastName}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{employee.employeeId}</span>
                <span>&middot;</span>
                <span>{employee.designation?.title || 'No designation'}</span>
                <Badge variant={statusInfo.variant} className="ml-2">
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        {can('employee:update') && (
          <Link href={`/employees/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Personal Info */}
            <div className="rounded-lg border p-6">
              <h3 className="mb-4 font-heading text-lg text-foreground">Personal Information</h3>
              <div className="space-y-4">
                <InfoRow icon={Mail} label="Work Email" value={employee.email} />
                <InfoRow icon={Mail} label="Personal Email" value={employee.personalEmail} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone} />
                <InfoRow
                  icon={Calendar}
                  label="Date of Birth"
                  value={employee.dateOfBirth ? format(new Date(employee.dateOfBirth), 'MMM d, yyyy') : null}
                />
                <InfoRow icon={User} label="Gender" value={employee.gender} />
                <InfoRow icon={MapPin} label="Nationality" value={employee.nationality} />
              </div>
            </div>

            {/* Work Info */}
            <div className="rounded-lg border p-6">
              <h3 className="mb-4 font-heading text-lg text-foreground">Work Information</h3>
              <div className="space-y-4">
                <InfoRow icon={Building2} label="Department" value={employee.department?.name} />
                <InfoRow icon={Briefcase} label="Designation" value={employee.designation?.title} />
                <InfoRow
                  icon={User}
                  label="Reports To"
                  value={
                    employee.reportingTo
                      ? `${employee.reportingTo.firstName} ${employee.reportingTo.lastName}`
                      : null
                  }
                />
                <InfoRow icon={MapPin} label="Region" value={employee.region} />
                <InfoRow icon={MapPin} label="Work Location" value={employee.workLocation} />
                <InfoRow
                  icon={Calendar}
                  label="Joined"
                  value={format(new Date(employee.joinedAt), 'MMM d, yyyy')}
                />
                <InfoRow icon={Briefcase} label="Employment Type" value={employee.employmentType.replace('_', ' ')} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="employment" className="mt-6">
          <div className="rounded-lg border p-6">
            <h3 className="mb-4 font-heading text-lg text-foreground">Employment Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoRow icon={Calendar} label="Probation Ends" value={employee.probationEndsAt ? format(new Date(employee.probationEndsAt), 'MMM d, yyyy') : 'N/A'} />
              <InfoRow icon={Calendar} label="Confirmed At" value={employee.confirmedAt ? format(new Date(employee.confirmedAt), 'MMM d, yyyy') : 'Not confirmed'} />
              <InfoRow icon={Briefcase} label="Notice Period" value={`${employee.noticePeriodDays} days`} />
              <InfoRow icon={Calendar} label="Last Working Day" value={employee.lastWorkingDay ? format(new Date(employee.lastWorkingDay), 'MMM d, yyyy') : 'N/A'} />
              {employee.terminationReason && (
                <InfoRow icon={User} label="Termination Reason" value={employee.terminationReason} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <div className="rounded-lg border p-6">
            <h3 className="mb-4 font-heading text-lg text-foreground">Documents</h3>
            <p className="text-sm text-muted-foreground">
              Document management will be available once the documents module is implemented.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
          <div className="rounded-lg border p-6">
            <h3 className="mb-4 font-heading text-lg text-foreground">Leave History</h3>
            <p className="text-sm text-muted-foreground">
              Leave history will be available once the leave module is implemented.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
