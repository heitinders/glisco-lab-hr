import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or fewer'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or fewer'),
  email: z.string().email('Invalid email address'),
  personalEmail: z.string().email('Invalid personal email').optional().nullable(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z
    .enum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'])
    .optional()
    .nullable(),
  nationality: z.string().max(100).optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  reportingToId: z.string().cuid().optional().nullable(),
  region: z.enum(['US', 'INDIA', 'REMOTE']).default('US'),
  employmentType: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'])
    .default('FULL_TIME'),
  joinedAt: z.string().datetime('Invalid join date'),
  probationEndsAt: z.string().datetime().optional().nullable(),
  workLocation: z.string().max(200).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Password must include uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
