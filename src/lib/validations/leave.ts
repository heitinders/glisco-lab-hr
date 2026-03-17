import { z } from 'zod';

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().cuid('Invalid leave type'),
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date'),
    reason: z
      .string()
      .min(1, 'Reason is required')
      .max(500, 'Reason must be 500 characters or fewer'),
    isHalfDay: z.boolean().default(false),
    halfDayType: z
      .enum(['FIRST_HALF', 'SECOND_HALF'])
      .optional()
      .nullable(),
    attachmentUrl: z.string().url().optional().nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      if (data.isHalfDay && !data.halfDayType) {
        return false;
      }
      return true;
    },
    {
      message: 'Half day type is required when requesting a half day',
      path: ['halfDayType'],
    }
  )
  .refine(
    (data) => {
      if (data.isHalfDay) {
        return data.startDate === data.endDate;
      }
      return true;
    },
    {
      message: 'Half day leave must be a single day',
      path: ['endDate'],
    }
  );

export const approveLeaveSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectedReason: z.string().max(500).optional().nullable(),
});

export const cancelLeaveSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

export type CreateLeaveRequestInput = z.input<typeof createLeaveRequestSchema>;
export type ApproveLeaveInput = z.input<typeof approveLeaveSchema>;
export type CancelLeaveInput = z.input<typeof cancelLeaveSchema>;
