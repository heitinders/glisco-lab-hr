import { z } from 'zod';

// ---------------------------------------------------------------------------
// Review Cycle — shared date fields
// ---------------------------------------------------------------------------

const reviewCycleDateFields = {
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  selfReviewDeadline: z.string().datetime('Invalid self review deadline'),
  peerReviewDeadline: z.string().datetime('Invalid peer review deadline'),
  managerReviewDeadline: z.string().datetime('Invalid manager review deadline'),
  hrReviewDeadline: z.string().datetime().optional().nullable(),
};

// ---------------------------------------------------------------------------
// Create Review Cycle
// ---------------------------------------------------------------------------
// Note: companyId is injected from session, never accepted from the client.

export const createReviewCycleSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Cycle name is required')
      .max(200, 'Cycle name must be 200 characters or fewer'),
    ...reviewCycleDateFields,
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      const self = new Date(data.selfReviewDeadline);
      const peer = new Date(data.peerReviewDeadline);
      const manager = new Date(data.managerReviewDeadline);
      return self <= peer && peer <= manager;
    },
    {
      message:
        'Deadlines must be in order: self review, then peer review, then manager review',
      path: ['managerReviewDeadline'],
    }
  );

// ---------------------------------------------------------------------------
// Update Review Cycle
// ---------------------------------------------------------------------------
// All fields optional. When dates are provided, the same ordering rules apply.

export const updateReviewCycleSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Cycle name is required')
      .max(200, 'Cycle name must be 200 characters or fewer')
      .optional(),
    startDate: z.string().datetime('Invalid start date').optional(),
    endDate: z.string().datetime('Invalid end date').optional(),
    selfReviewDeadline: z.string().datetime('Invalid self review deadline').optional(),
    peerReviewDeadline: z.string().datetime('Invalid peer review deadline').optional(),
    managerReviewDeadline: z.string().datetime('Invalid manager review deadline').optional(),
    hrReviewDeadline: z.string().datetime().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // Only enforce ordering when all three deadline fields are supplied
      if (data.selfReviewDeadline && data.peerReviewDeadline && data.managerReviewDeadline) {
        const self = new Date(data.selfReviewDeadline);
        const peer = new Date(data.peerReviewDeadline);
        const manager = new Date(data.managerReviewDeadline);
        return self <= peer && peer <= manager;
      }
      return true;
    },
    {
      message:
        'Deadlines must be in order: self review, then peer review, then manager review',
      path: ['managerReviewDeadline'],
    }
  );

export const submitReviewSchema = z.object({
  reviewId: z.string().cuid('Invalid review ID'),
  ratings: z.record(
    z.string(),
    z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5')
  ),
  overallRating: z
    .number()
    .min(1, 'Overall rating must be at least 1')
    .max(5, 'Overall rating must be at most 5')
    .optional(),
  strengths: z
    .string()
    .max(2000, 'Strengths must be 2000 characters or fewer')
    .optional()
    .nullable(),
  improvements: z
    .string()
    .max(2000, 'Improvements must be 2000 characters or fewer')
    .optional()
    .nullable(),
  comments: z
    .string()
    .max(3000, 'Comments must be 3000 characters or fewer')
    .optional()
    .nullable(),
});

// ---------------------------------------------------------------------------
// Stage-specific review submission schemas
// ---------------------------------------------------------------------------

const ratingField = z
  .number()
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating must be at most 5');

const textField = (maxLen: number, label: string) =>
  z
    .string()
    .max(maxLen, `${label} must be ${maxLen} characters or fewer`)
    .optional()
    .nullable();

export const selfReviewSubmissionSchema = z.object({
  selfRating: ratingField,
  strengths: textField(2000, 'Strengths'),
  improvements: textField(2000, 'Improvements'),
  comments: textField(3000, 'Comments'),
});

export const managerReviewSubmissionSchema = z.object({
  managerRating: ratingField,
  strengths: textField(2000, 'Strengths'),
  improvements: textField(2000, 'Improvements'),
  comments: textField(3000, 'Comments'),
});

export const hrReviewSubmissionSchema = z.object({
  finalRating: ratingField,
  comments: textField(3000, 'Comments'),
});

export const createPeerReviewSchema = z.object({
  cycleId: z.string().cuid('Invalid cycle ID'),
  subjectId: z.string().cuid('Invalid subject employee ID'),
  reviewerId: z.string().cuid('Invalid reviewer employee ID'),
  type: z.literal('PEER'),
});

export type SelfReviewSubmissionInput = z.input<typeof selfReviewSubmissionSchema>;
export type ManagerReviewSubmissionInput = z.input<typeof managerReviewSubmissionSchema>;
export type HrReviewSubmissionInput = z.input<typeof hrReviewSubmissionSchema>;
export type CreatePeerReviewInput = z.input<typeof createPeerReviewSchema>;

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export const createGoalSchema = z.object({
  employeeId: z.string().cuid('Invalid employee ID'),
  title: z
    .string()
    .min(1, 'Goal title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  cycleId: z.string().cuid().optional().nullable(),
  keyResults: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        target: z.number().min(0),
        current: z.number().min(0).default(0),
        unit: z.string().max(50).optional(),
      })
    )
    .default([]),
});

export type CreateReviewCycleInput = z.input<typeof createReviewCycleSchema>;
export type UpdateReviewCycleInput = z.input<typeof updateReviewCycleSchema>;
export type SubmitReviewInput = z.input<typeof submitReviewSchema>;
export type CreateGoalInput = z.input<typeof createGoalSchema>;
