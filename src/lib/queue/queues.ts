import type Queue from 'bull';

const defaultJobOptions: Queue.JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

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

// ─── Lazy Queue Factory (avoids importing Bull at build time) ───────────────

const queues = new Map<string, Queue.Queue>();

function getQueue<T>(name: string): Queue.Queue<T> {
  if (queues.has(name)) {
    return queues.get(name) as Queue.Queue<T>;
  }

  // Dynamic import at runtime only — keeps Bull out of the Vercel build
  const BullQueue = require('bull') as typeof Queue;
  const { getRedisConnection } = require('./connection');

  const queue = new BullQueue<T>(name, {
    createClient: () => getRedisConnection().duplicate(),
    defaultJobOptions,
  });

  queues.set(name, queue);
  return queue;
}

export const emailQueue = {
  add: (...args: Parameters<Queue.Queue<EmailJobData>['add']>) =>
    getQueue<EmailJobData>('email').add(...args),
};

export const payrollQueue = {
  add: (...args: Parameters<Queue.Queue<PayrollJobData>['add']>) =>
    getQueue<PayrollJobData>('payroll').add(...args),
};

export const pdfQueue = {
  add: (...args: Parameters<Queue.Queue<PdfJobData>['add']>) =>
    getQueue<PdfJobData>('pdf').add(...args),
};

export const notificationQueue = {
  add: (...args: Parameters<Queue.Queue<NotificationJobData>['add']>) =>
    getQueue<NotificationJobData>('notification').add(...args),
};
