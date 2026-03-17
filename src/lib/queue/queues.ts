import Queue from 'bull';
import { getRedisConnection } from './connection';

const defaultJobOptions: Queue.JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

function createQueue<T>(name: string) {
  return new Queue<T>(name, {
    createClient: () => getRedisConnection().duplicate(),
    defaultJobOptions,
  });
}

// ─── Queue Definitions ──────────────────────────────────────────────────────

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

export const emailQueue = createQueue<EmailJobData>('email');
export const payrollQueue = createQueue<PayrollJobData>('payroll');
export const pdfQueue = createQueue<PdfJobData>('pdf');
export const notificationQueue = createQueue<NotificationJobData>('notification');
