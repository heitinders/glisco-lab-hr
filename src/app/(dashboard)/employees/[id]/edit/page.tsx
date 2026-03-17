'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import {
  updateEmployeeSchema,
  type UpdateEmployeeInput,
} from '@/lib/validations/employee';
import { useEmployee, useUpdateEmployee } from '@/hooks/use-employees';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface DesignationOption {
  id: string;
  title: string;
  level: number;
}

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const REGION_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'INDIA', label: 'India' },
  { value: 'REMOTE', label: 'Remote' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'CONSULTANT', label: 'Consultant' },
];

/** Convert an ISO datetime string to yyyy-MM-dd for a date input. */
function toDateInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    return format(new Date(isoString), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="space-y-8">
        <div className="rounded-lg border p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: employee, isLoading: isLoadingEmployee } = useEmployee(id);
  const updateEmployee = useUpdateEmployee(id);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
  });

  // Fetch dropdown options
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [deptRes, desigRes, empRes] = await Promise.allSettled([
          apiClient.get<{ data: DepartmentOption[] }>('/api/departments'),
          apiClient.get<{ data: DesignationOption[] }>('/api/designations'),
          apiClient.get<{ data: EmployeeOption[] }>(
            '/api/employees?pageSize=100'
          ),
        ]);

        if (deptRes.status === 'fulfilled') {
          const result = deptRes.value;
          setDepartments(Array.isArray(result) ? result : result.data ?? []);
        }
        if (desigRes.status === 'fulfilled') {
          const result = desigRes.value;
          setDesignations(Array.isArray(result) ? result : result.data ?? []);
        }
        if (empRes.status === 'fulfilled') {
          const result = empRes.value;
          setEmployees(Array.isArray(result) ? result : result.data ?? []);
        }
      } catch {
        // Options will remain empty
      }
    }
    fetchOptions();
  }, []);

  // Pre-fill form when employee data arrives
  useEffect(() => {
    if (!employee) return;
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      personalEmail: employee.personalEmail ?? undefined,
      phone: employee.phone ?? undefined,
      dateOfBirth: employee.dateOfBirth
        ? new Date(employee.dateOfBirth).toISOString()
        : undefined,
      gender: (employee.gender as UpdateEmployeeInput['gender']) ?? undefined,
      nationality: employee.nationality ?? undefined,
      departmentId: employee.departmentId ?? undefined,
      designationId: employee.designationId ?? undefined,
      reportingToId: employee.reportingToId ?? undefined,
      region: (employee.region as UpdateEmployeeInput['region']) ?? undefined,
      employmentType:
        (employee.employmentType as UpdateEmployeeInput['employmentType']) ??
        undefined,
      joinedAt: new Date(employee.joinedAt).toISOString(),
      probationEndsAt: employee.probationEndsAt
        ? new Date(employee.probationEndsAt).toISOString()
        : undefined,
      workLocation: employee.workLocation ?? undefined,
    });
  }, [employee, reset]);

  async function onSubmit(data: UpdateEmployeeInput) {
    try {
      await updateEmployee.mutateAsync(data as Record<string, unknown>);
      toast.success('Employee updated successfully');
      router.push(`/employees/${id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update employee';
      toast.error(message);
    }
  }

  if (isLoadingEmployee) {
    return <FormSkeleton />;
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-2xl text-foreground">
          Employee not found
        </h1>
        <Link href="/employees">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href={`/employees/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Edit Employee
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update details for {employee.firstName} {employee.lastName} (
            {employee.employeeId}).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ── Personal Information ── */}
        <section className="rounded-lg border p-6">
          <h3 className="mb-4 font-heading text-lg text-foreground">
            Personal Information
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-xs text-red-500">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-xs text-red-500">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            {/* Work Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@gliscolab.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Personal Email */}
            <div className="space-y-2">
              <Label htmlFor="personalEmail">Personal Email</Label>
              <Input
                id="personalEmail"
                type="email"
                placeholder="john@gmail.com"
                {...register('personalEmail')}
              />
              {errors.personalEmail && (
                <p className="text-xs text-red-500">
                  {errors.personalEmail.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                defaultValue={toDateInputValue(
                  employee.dateOfBirth as string | null
                )}
                {...register('dateOfBirth', {
                  setValueAs: (v: string) =>
                    v ? new Date(v).toISOString() : undefined,
                })}
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-red-500">
                  {errors.dateOfBirth.message}
                </p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                defaultValue={employee.gender ?? undefined}
                onValueChange={(value) =>
                  setValue(
                    'gender',
                    value as UpdateEmployeeInput['gender'],
                    { shouldValidate: true, shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs text-red-500">{errors.gender.message}</p>
              )}
            </div>

            {/* Nationality */}
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                placeholder="United States"
                {...register('nationality')}
              />
              {errors.nationality && (
                <p className="text-xs text-red-500">
                  {errors.nationality.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Employment Details ── */}
        <section className="rounded-lg border p-6">
          <h3 className="mb-4 font-heading text-lg text-foreground">
            Employment Details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Department */}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                defaultValue={employee.departmentId ?? undefined}
                onValueChange={(value) =>
                  setValue('departmentId', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && (
                <p className="text-xs text-red-500">
                  {errors.departmentId.message}
                </p>
              )}
            </div>

            {/* Designation */}
            <div className="space-y-2">
              <Label>Designation</Label>
              <Select
                defaultValue={employee.designationId ?? undefined}
                onValueChange={(value) =>
                  setValue('designationId', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((desig) => (
                    <SelectItem key={desig.id} value={desig.id}>
                      {desig.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.designationId && (
                <p className="text-xs text-red-500">
                  {errors.designationId.message}
                </p>
              )}
            </div>

            {/* Reporting To */}
            <div className="space-y-2">
              <Label>Reports To</Label>
              <Select
                defaultValue={employee.reportingToId ?? undefined}
                onValueChange={(value) =>
                  setValue('reportingToId', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((emp) => emp.id !== id)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.reportingToId && (
                <p className="text-xs text-red-500">
                  {errors.reportingToId.message}
                </p>
              )}
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                defaultValue={employee.region}
                onValueChange={(value) =>
                  setValue(
                    'region',
                    value as UpdateEmployeeInput['region'],
                    { shouldValidate: true, shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.region && (
                <p className="text-xs text-red-500">{errors.region.message}</p>
              )}
            </div>

            {/* Employment Type */}
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select
                defaultValue={employee.employmentType}
                onValueChange={(value) =>
                  setValue(
                    'employmentType',
                    value as UpdateEmployeeInput['employmentType'],
                    { shouldValidate: true, shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employmentType && (
                <p className="text-xs text-red-500">
                  {errors.employmentType.message}
                </p>
              )}
            </div>

            {/* Joined At */}
            <div className="space-y-2">
              <Label htmlFor="joinedAt">Join Date</Label>
              <Input
                id="joinedAt"
                type="date"
                defaultValue={toDateInputValue(
                  employee.joinedAt as unknown as string
                )}
                {...register('joinedAt', {
                  setValueAs: (v: string) =>
                    v ? new Date(v).toISOString() : undefined,
                })}
              />
              {errors.joinedAt && (
                <p className="text-xs text-red-500">
                  {errors.joinedAt.message}
                </p>
              )}
            </div>

            {/* Probation Ends At */}
            <div className="space-y-2">
              <Label htmlFor="probationEndsAt">Probation End Date</Label>
              <Input
                id="probationEndsAt"
                type="date"
                defaultValue={toDateInputValue(
                  employee.probationEndsAt as string | null
                )}
                {...register('probationEndsAt', {
                  setValueAs: (v: string) =>
                    v ? new Date(v).toISOString() : undefined,
                })}
              />
              {errors.probationEndsAt && (
                <p className="text-xs text-red-500">
                  {errors.probationEndsAt.message}
                </p>
              )}
            </div>

            {/* Work Location */}
            <div className="space-y-2">
              <Label htmlFor="workLocation">Work Location</Label>
              <Input
                id="workLocation"
                placeholder="New York, NY"
                {...register('workLocation')}
              />
              {errors.workLocation && (
                <p className="text-xs text-red-500">
                  {errors.workLocation.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/employees/${id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
