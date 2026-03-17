import { z } from 'zod';

const createJobBaseSchema = z.object({
  title: z
    .string()
    .min(1, 'Job title is required')
    .max(200, 'Job title must be 200 characters or fewer'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description must be 10000 characters or fewer'),
  requirements: z.string().max(5000).optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  employmentType: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'])
    .default('FULL_TIME'),
  region: z.enum(['US', 'INDIA', 'REMOTE']).default('US'),
  salaryMin: z.number().min(0, 'Minimum salary must be positive').optional().nullable(),
  salaryMax: z.number().min(0, 'Maximum salary must be positive').optional().nullable(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
  openings: z.number().int().min(1, 'Must have at least 1 opening').default(1),
  closesAt: z.string().datetime().optional().nullable(),
  hiringManagerId: z.string().cuid().optional().nullable(),
  companyId: z.string().cuid('Invalid company ID'),
});

export const createJobSchema = createJobBaseSchema.refine(
  (data) => {
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMax >= data.salaryMin;
    }
    return true;
  },
  {
    message: 'Maximum salary must be greater than or equal to minimum salary',
    path: ['salaryMax'],
  }
);

export const updateJobSchema = createJobBaseSchema.partial().omit({ companyId: true });

export const createCandidateSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or fewer'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or fewer'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  resumeUrl: z.string().url('Invalid resume URL').optional().nullable(),
  coverLetterUrl: z.string().url('Invalid cover letter URL').optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  referredById: z.string().cuid().optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export const updateCandidateStageSchema = z.object({
  stage: z.enum([
    'APPLIED',
    'SCREENING',
    'PHONE_INTERVIEW',
    'TECHNICAL',
    'FINAL_INTERVIEW',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'HIRED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  notes: z.string().max(3000).optional().nullable(),
  rejectedReason: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

export const scorecardSchema = z.object({
  candidateId: z.string().cuid('Invalid candidate ID'),
  interviewerId: z.string().cuid('Invalid interviewer ID'),
  criteria: z.array(
    z.object({
      name: z.string().min(1).max(100),
      rating: z.number().int().min(1).max(5),
      notes: z.string().max(500).optional(),
    })
  ),
  overallRecommendation: z.enum([
    'STRONG_HIRE',
    'HIRE',
    'NO_HIRE',
    'STRONG_NO_HIRE',
  ]),
  summary: z.string().max(2000).optional().nullable(),
});

export type CreateJobInput = z.input<typeof createJobSchema>;
export type UpdateJobInput = z.input<typeof updateJobSchema>;
export type CreateCandidateInput = z.input<typeof createCandidateSchema>;
export type UpdateCandidateStageInput = z.input<typeof updateCandidateStageSchema>;
export type ScorecardInput = z.input<typeof scorecardSchema>;
