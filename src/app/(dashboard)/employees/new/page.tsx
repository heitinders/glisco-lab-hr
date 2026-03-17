'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  createEmployeeSchema,
  type CreateEmployeeInput,
} from '@/lib/validations/employee';
import { useCreateEmployee } from '@/hooks/use-employees';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function AddEmployeePage() {
  const router = useRouter();
  const createEmployee = useCreateEmployee();

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      region: 'US',
      employmentType: 'FULL_TIME',
    },
  });

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
        // Options will remain empty — selects will show no items
      }
    }
    fetchOptions();
  }, []);

  async function onSubmit(data: CreateEmployeeInput) {
    try {
      const result = await createEmployee.mutateAsync(
        data as Record<string, unknown>
      );
      toast.success('Employee created successfully');
      const created = result as { id?: string };
      router.push(`/employees/${created.id ?? ''}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create employee';
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Add Employee
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in the details below to add a new employee to the organization.
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
              <Label htmlFor="firstName">
                First Name <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="lastName">
                Last Name <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="email">
                Work Email <span className="text-red-500">*</span>
              </Label>
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
                onValueChange={(value) =>
                  setValue(
                    'gender',
                    value as CreateEmployeeInput['gender'],
                    { shouldValidate: true }
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
                onValueChange={(value) =>
                  setValue('departmentId', value, { shouldValidate: true })
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
                onValueChange={(value) =>
                  setValue('designationId', value, { shouldValidate: true })
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
                onValueChange={(value) =>
                  setValue('reportingToId', value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
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
              <Label>
                Region <span className="text-red-500">*</span>
              </Label>
              <Select
                defaultValue="US"
                onValueChange={(value) =>
                  setValue('region', value as CreateEmployeeInput['region'], {
                    shouldValidate: true,
                  })
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
              <Label>
                Employment Type <span className="text-red-500">*</span>
              </Label>
              <Select
                defaultValue="FULL_TIME"
                onValueChange={(value) =>
                  setValue(
                    'employmentType',
                    value as CreateEmployeeInput['employmentType'],
                    { shouldValidate: true }
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
              <Label htmlFor="joinedAt">
                Join Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="joinedAt"
                type="date"
                {...register('joinedAt', {
                  setValueAs: (v: string) =>
                    v ? new Date(v).toISOString() : '',
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
          <Link href="/employees">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
