export { emailQueue, payrollQueue, pdfQueue, notificationQueue } from './queues';
export type { EmailJobData, PayrollJobData, PdfJobData, NotificationJobData } from './queues';

// Bull/ioredis are NOT imported here — they are incompatible with serverless.
// For queue processing, run cron.ts and workers.ts in a dedicated worker process.

// Re-declare the type here to avoid importing cron.ts (which imports Bull)
export interface CronJobData {
  jobType: string;
}
