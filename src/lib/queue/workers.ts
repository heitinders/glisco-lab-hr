import { emailQueue, payrollQueue, pdfQueue, notificationQueue } from './queues';
import type { EmailJobData, PayrollJobData, PdfJobData, NotificationJobData } from './queues';
import { cronQueue, processCronJob, registerCronJobs } from './cron';
import { sendEmail } from '@/lib/email/sender';
import { db } from '@/lib/db';
import {
  generatePayslipPDF,
  type PayslipData,
  type EmployeeData,
  type CompanyData,
} from '@/lib/pdf/payslip';

// ─── Email Worker ───────────────────────────────────────────────────────────

emailQueue.process(async (job) => {
  const { to, subject, html } = job.data as EmailJobData;
  console.log(`[email] Sending to ${Array.isArray(to) ? to.join(', ') : to}: ${subject}`);
  await sendEmail({ to, subject, html });
  return { sent: true };
});

emailQueue.on('failed', (job, err) => {
  console.error(`[email] Job ${job.id} failed:`, err.message);
});

// ─── Payroll Worker (skeleton) ──────────────────────────────────────────────

payrollQueue.process(async (job) => {
  const { payrollRunId } = job.data as PayrollJobData;
  console.log(`[payroll] Processing payroll run: ${payrollRunId}`);
  // TODO: Implement payroll calculation
  return { processed: true };
});

payrollQueue.on('failed', (job, err) => {
  console.error(`[payroll] Job ${job.id} failed:`, err.message);
});

// ─── PDF Worker ─────────────────────────────────────────────────────────────

pdfQueue.process(async (job) => {
  const { type, entityId } = job.data as PdfJobData;
  console.log(`[pdf] Generating ${type} PDF for: ${entityId}`);

  switch (type) {
    case 'payslip':
      return await processPayslipPdf(entityId);
    case 'offer_letter':
      // TODO: Implement offer letter PDF generation
      console.log(`[pdf] offer_letter generation not yet implemented`);
      return { generated: false, reason: 'not_implemented' };
    case 'experience_letter':
      // TODO: Implement experience letter PDF generation
      console.log(`[pdf] experience_letter generation not yet implemented`);
      return { generated: false, reason: 'not_implemented' };
    default:
      throw new Error(`[pdf] Unknown PDF type: ${type}`);
  }
});

pdfQueue.on('failed', (job, err) => {
  console.error(`[pdf] Job ${job.id} failed:`, err.message);
});

/**
 * Fetch payslip + related data from the database, generate the PDF,
 * store it as a base64 data URL, and update the Payslip record.
 */
async function processPayslipPdf(payslipId: string) {
  // 1. Fetch payslip with employee, designation, department, and company
  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        include: {
          designation: true,
          department: true,
          company: true,
        },
      },
    },
  });

  if (!payslip) {
    throw new Error(`Payslip ${payslipId} not found`);
  }

  const { employee } = payslip;
  if (!employee) {
    throw new Error(`Employee not found for payslip ${payslipId}`);
  }

  // 2. Map Prisma data to PDF interfaces
  const allowances = Array.isArray(payslip.allowances)
    ? (payslip.allowances as { label: string; amount: number }[])
    : [];

  const deductions = Array.isArray(payslip.deductions)
    ? (payslip.deductions as { label: string; amount: number }[])
    : [];

  const bankDetails = payslip.employee.bankDetails as {
    bankName?: string;
    accountNumber?: string;
  } | null;

  const companyAddress = employee.company.address as {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;

  const addressParts = companyAddress
    ? [companyAddress.street, companyAddress.city, companyAddress.state, companyAddress.zip, companyAddress.country]
        .filter(Boolean)
        .join(', ')
    : undefined;

  const payslipData: PayslipData = {
    period: payslip.period,
    currency: payslip.currency,
    basicSalary: Number(payslip.basicSalary),
    hra: payslip.hra !== null ? Number(payslip.hra) : null,
    allowances,
    deductions,
    grossPay: Number(payslip.grossPay),
    taxDeducted: Number(payslip.taxDeducted),
    stateTax: payslip.stateTax !== null ? Number(payslip.stateTax) : null,
    pf: payslip.pf !== null ? Number(payslip.pf) : null,
    esi: payslip.esi !== null ? Number(payslip.esi) : null,
    netPay: Number(payslip.netPay),
    leaveDays: payslip.leaveDays,
    overtimePay: payslip.overtimePay !== null ? Number(payslip.overtimePay) : null,
    bonuses: payslip.bonuses !== null ? Number(payslip.bonuses) : null,
  };

  const employeeData: EmployeeData = {
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeId: employee.employeeId,
    email: employee.email,
    department: employee.department?.name ?? 'N/A',
    designation: employee.designation?.title ?? 'N/A',
    bankDetails: bankDetails ?? null,
  };

  const companyData: CompanyData = {
    name: employee.company.name,
    address: addressParts,
  };

  // 3. Generate PDF buffer
  const pdfBuffer = await generatePayslipPDF(payslipData, employeeData, companyData);

  // 4. Store as base64 data URL and update the payslip record
  const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

  await db.payslip.update({
    where: { id: payslipId },
    data: { pdfUrl: dataUrl },
  });

  console.log(`[pdf] Payslip PDF generated for ${payslipId} (${pdfBuffer.length} bytes)`);
  return { generated: true, payslipId, sizeBytes: pdfBuffer.length };
}

// ─── Notification Worker (skeleton) ─────────────────────────────────────────

notificationQueue.process(async (job) => {
  const data = job.data as NotificationJobData;
  console.log(`[notification] Sending to ${data.employeeId}: ${data.title}`);
  // TODO: Create DB notification + send email
  return { notified: true };
});

notificationQueue.on('failed', (job, err) => {
  console.error(`[notification] Job ${job.id} failed:`, err.message);
});

// ─── Cron Worker ────────────────────────────────────────────────────────────

cronQueue.process(async (job) => {
  return await processCronJob(job);
});

cronQueue.on('failed', (job, err) => {
  console.error(`[cron] Job ${job.id} (${job.data?.jobType}) failed:`, err.message);
});

cronQueue.on('completed', (job, result) => {
  console.log(`[cron] Job ${job.id} (${job.data?.jobType}) completed:`, result);
});

// Register all repeatable cron schedules on startup
registerCronJobs().catch((err) => {
  console.error('[cron] Failed to register cron jobs:', err);
});
