'use client';

import { useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { ArrowLeft, AlertTriangle, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createLeaveRequestSchema, type CreateLeaveRequestInput } from '@/lib/validations/leave';
import { useLeaveBalance, useCreateLeaveRequest } from '@/hooks/use-leave';
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
import type { LeaveBalanceSummary } from '@/types/leave';

/**
 * Calculate business days between two dates (excluding weekends).
 */
function calculateBusinessDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;

  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Convert a date string (YYYY-MM-DD) to ISO datetime string for the Zod schema.
 */
function toDatetimeString(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00.000Z').toISOString();
}

/**
 * Convert an ISO datetime string back to YYYY-MM-DD for the date input.
 */
function toDateInputValue(datetimeStr: string): string {
  if (!datetimeStr) return '';
  try {
    return format(new Date(datetimeStr), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export default function ApplyForLeavePage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear().toString();
  const { data: balanceData, isLoading: balanceLoading } = useLeaveBalance({
    year: currentYear,
  });
  const { mutateAsync: createLeave, isPending: isSubmitting } = useCreateLeaveRequest();

  const balances = (balanceData?.data || []) as LeaveBalanceSummary[];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateLeaveRequestInput>({
    resolver: zodResolver(createLeaveRequestSchema),
    defaultValues: {
      leaveTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
      isHalfDay: false,
      halfDayType: null,
      attachmentUrl: null,
    },
  });

  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
  const watchIsHalfDay = watch('isHalfDay');
  const watchLeaveTypeId = watch('leaveTypeId');

  // When half day is toggled on, sync end date to start date
  useEffect(() => {
    if (watchIsHalfDay && watchStartDate) {
      setValue('endDate', watchStartDate);
    }
  }, [watchIsHalfDay, watchStartDate, setValue]);

  // Calculate business days
  const businessDays = useMemo(() => {
    if (watchIsHalfDay) return 0.5;
    return calculateBusinessDays(
      toDateInputValue(watchStartDate),
      toDateInputValue(watchEndDate)
    );
  }, [watchStartDate, watchEndDate, watchIsHalfDay]);

  // Find selected leave balance
  const selectedBalance = useMemo(() => {
    if (!watchLeaveTypeId) return null;
    return balances.find((b) => b.leaveTypeId === watchLeaveTypeId) || null;
  }, [watchLeaveTypeId, balances]);

  // Check if requested days exceed available balance
  const exceedsBalance = useMemo(() => {
    if (!selectedBalance || businessDays <= 0) return false;
    return businessDays > selectedBalance.available;
  }, [selectedBalance, businessDays]);

  const onSubmit = useCallback(
    async (data: CreateLeaveRequestInput) => {
      try {
        await createLeave(data as unknown as Record<string, unknown>);
        toast.success('Leave request submitted successfully');
        router.push('/leave');
      } catch {
        toast.error('Failed to submit leave request. Please try again.');
      }
    },
    [createLeave, router]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/leave">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Apply for Leave
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a new leave request for approval.
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-lg border border-[#0B0F1A]/10 bg-white p-6 shadow-sm"
      >
        {/* Leave Type */}
        <div className="space-y-2">
          <Label htmlFor="leaveTypeId">Leave Type</Label>
          {balanceLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Controller
              name="leaveTypeId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="leaveTypeId">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {balances.map((balance) => (
                      <SelectItem key={balance.leaveTypeId} value={balance.leaveTypeId}>
                        {balance.leaveTypeName} ({balance.available} days available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {errors.leaveTypeId && (
            <p className="text-xs text-red-500">{errors.leaveTypeId.message}</p>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <Input
                  id="startDate"
                  type="date"
                  value={toDateInputValue(field.value)}
                  onChange={(e) => {
                    field.onChange(toDatetimeString(e.target.value));
                    if (watchIsHalfDay) {
                      setValue('endDate', toDatetimeString(e.target.value));
                    }
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              )}
            />
            {errors.startDate && (
              <p className="text-xs text-red-500">{errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <Input
                  id="endDate"
                  type="date"
                  value={toDateInputValue(field.value)}
                  onChange={(e) => field.onChange(toDatetimeString(e.target.value))}
                  min={toDateInputValue(watchStartDate) || format(new Date(), 'yyyy-MM-dd')}
                  disabled={watchIsHalfDay}
                />
              )}
            />
            {errors.endDate && (
              <p className="text-xs text-red-500">{errors.endDate.message}</p>
            )}
          </div>
        </div>

        {/* Half Day Toggle */}
        <div className="flex items-center justify-between rounded-md border border-[#0B0F1A]/10 p-4">
          <div>
            <Label htmlFor="isHalfDay" className="cursor-pointer">
              Half Day
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Request only half a day of leave
            </p>
          </div>
          <Controller
            name="isHalfDay"
            control={control}
            render={({ field }) => (
              <button
                id="isHalfDay"
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => {
                  const newValue = !field.value;
                  field.onChange(newValue);
                  if (!newValue) {
                    setValue('halfDayType', null);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF] focus-visible:ring-offset-2 ${
                  field.value ? 'bg-[#4B9EFF]' : 'bg-[#0B0F1A]/20'
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                    field.value ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          />
        </div>

        {/* Half Day Type (conditionally shown) */}
        {watchIsHalfDay && (
          <div className="space-y-2">
            <Label htmlFor="halfDayType">Half Day Type</Label>
            <Controller
              name="halfDayType"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={(v) => field.onChange(v as 'FIRST_HALF' | 'SECOND_HALF')}
                >
                  <SelectTrigger id="halfDayType">
                    <SelectValue placeholder="Select half day type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST_HALF">First Half</SelectItem>
                    <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.halfDayType && (
              <p className="text-xs text-red-500">{errors.halfDayType.message}</p>
            )}
          </div>
        )}

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <textarea
            id="reason"
            {...register('reason')}
            placeholder="Provide a reason for your leave request..."
            rows={4}
            className="flex w-full rounded-md border border-[#0B0F1A]/20 bg-white px-3 py-2 text-sm font-[Syne] ring-offset-white placeholder:text-[#0B0F1A]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {errors.reason && (
            <p className="text-xs text-red-500">{errors.reason.message}</p>
          )}
        </div>

        {/* Day Calculation Display */}
        {businessDays > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-[#4B9EFF]/20 bg-[#4B9EFF]/5 p-4">
            <CalendarDays className="h-5 w-5 text-[#4B9EFF]" />
            <div>
              <p className="text-sm font-medium font-[Syne] text-foreground">
                {businessDays} business day{businessDays !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {watchStartDate && watchEndDate
                  ? `${format(new Date(watchStartDate), 'MMM dd, yyyy')} - ${format(new Date(watchEndDate), 'MMM dd, yyyy')}`
                  : ''}
                {watchIsHalfDay && ' (Half day)'}
              </p>
            </div>
          </div>
        )}

        {/* Balance Warning */}
        {exceedsBalance && selectedBalance && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium font-[Syne] text-amber-800">
                Insufficient leave balance
              </p>
              <p className="text-xs text-amber-700">
                You are requesting {businessDays} day{businessDays !== 1 ? 's' : ''} but only
                have {selectedBalance.available} day{selectedBalance.available !== 1 ? 's' : ''}{' '}
                of {selectedBalance.leaveTypeName} available. This request may be declined.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#0B0F1A]/10 pt-4">
          <Link href="/leave">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </div>
  );
}
