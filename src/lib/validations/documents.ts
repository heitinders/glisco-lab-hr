import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (must match prisma DocumentCategory and Region)
// ---------------------------------------------------------------------------

const documentCategoryEnum = z.enum([
  'OFFER_LETTER',
  'APPOINTMENT_LETTER',
  'NDA',
  'HANDBOOK',
  'POLICY',
  'CONTRACT',
  'ID_PROOF',
  'EDUCATIONAL',
  'PAYSLIP',
  'TAX_FORM',
  'FORM_16',
  'W2',
  'PERFORMANCE',
  'TERMINATION',
  'OTHER',
]);

const regionEnum = z.enum(['US', 'INDIA', 'REMOTE']);

// ---------------------------------------------------------------------------
// Document Upload Schema (POST /api/documents)
// ---------------------------------------------------------------------------

export const createDocumentSchema = z.object({
  employeeId: z.string().cuid('Invalid employee ID'),
  category: documentCategoryEnum,
  name: z
    .string()
    .min(1, 'Document name is required')
    .max(255, 'Document name must be 255 characters or fewer'),
  fileUrl: z.string().min(1, 'File URL is required'),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(255).optional(),
  expiresAt: z.string().datetime('Invalid expiry date').optional().nullable(),
  isConfidential: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Document List Query Schema (GET /api/documents)
// ---------------------------------------------------------------------------

export const documentListQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  category: documentCategoryEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ---------------------------------------------------------------------------
// Template Render Schema (POST /api/documents/templates/render)
// ---------------------------------------------------------------------------

export const renderTemplateSchema = z.object({
  templateId: z.string().cuid('Invalid template ID'),
  variables: z.record(z.string(), z.string()),
});

// ---------------------------------------------------------------------------
// Template List Query Schema (GET /api/documents/templates)
// ---------------------------------------------------------------------------

export const templateListQuerySchema = z.object({
  category: documentCategoryEnum.optional(),
  region: regionEnum.optional(),
});

// ---------------------------------------------------------------------------
// Upload Endpoint Schema (POST /api/upload)
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const fileUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be 255 characters or fewer'),
  fileType: z
    .string()
    .refine(
      (val) => (ALLOWED_MIME_TYPES as readonly string[]).includes(val),
      `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
    ),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`),
  base64Data: z.string().min(1, 'File data is required'),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;
export type DocumentListQuery = z.input<typeof documentListQuerySchema>;
export type RenderTemplateInput = z.input<typeof renderTemplateSchema>;
export type TemplateListQuery = z.input<typeof templateListQuerySchema>;
export type FileUploadInput = z.input<typeof fileUploadSchema>;

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
