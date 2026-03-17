export { emailQueue, payrollQueue, pdfQueue, notificationQueue } from './queues';
export type { EmailJobData, PayrollJobData, PdfJobData, NotificationJobData } from './queues';

// Cron and connection exports are lazy — only import directly when running
// a dedicated worker process, not from API routes.
// import { cronQueue, registerCronJobs } from '@/lib/queue/cron';
// import { getRedisConnection } from '@/lib/queue/connection';
export type { CronJobData } from './cron';
