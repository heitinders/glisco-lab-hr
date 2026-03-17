// ─── Type Definitions ──────────────────────────────────────────────────────

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
}

export interface PayrollJobData {
  payrollRunId: string;
}

export interface PdfJobData {
  type: 'payslip' | 'offer_letter' | 'experience_letter';
  entityId: string;
}

export interface NotificationJobData {
  employeeId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

// ─── Serverless-safe queue stubs ────────────────────────────────────────────
// Bull uses child_process.fork() which is incompatible with Vercel serverless.
// These stubs log the job data so nothing is silently lost.
// For actual queue processing, run a dedicated worker (e.g. on Railway/Render).

function createStubQueue<T>(name: string) {
  return {
    async add(data: T, opts?: Record<string, unknown>) {
      console.log(`[queue:${name}] Job enqueued:`, JSON.stringify(data));
      return { id: `stub-${Date.now()}`, data };
    },
  };
}

export const emailQueue = createStubQueue<EmailJobData>('email');
export const payrollQueue = createStubQueue<PayrollJobData>('payroll');
export const pdfQueue = createStubQueue<PdfJobData>('pdf');
export const notificationQueue = createStubQueue<NotificationJobData>('notification');
