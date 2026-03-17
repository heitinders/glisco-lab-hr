import Queue from 'bull';
import { getRedisConnection } from './connection';
import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';
import {
  startOfDay,
  endOfDay,
  addDays,
  getMonth,
  getDate,
  getYear,
  differenceInYears,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ─── Queue Definition ───────────────────────────────────────────────────────

export interface CronJobData {
  jobType:
    | 'birthday-reminder'
    | 'work-anniversary-reminder'
    | 'probation-ending-reminder'
    | 'document-expiry-warning'
    | 'leave-balance-expiry-warning';
  /** ISO timestamp when the cron tick was scheduled */
  scheduledAt: string;
}

const cronQueue = new Queue<CronJobData>('cron', {
  createClient: () => getRedisConnection().duplicate(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

export { cronQueue };

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default timezone for scheduling — matches Company.timezone default */
const SCHEDULE_TZ = 'America/New_York';

/** Roles that should receive HR-level cron notifications */
const HR_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch all employee IDs with an HR-level role in the given company.
 * These employees receive administrative notifications from cron jobs.
 */
async function getHrAdminIds(companyId: string): Promise<string[]> {
  const hrEmployees = await db.employee.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      user: { role: { in: [...HR_ROLES] } },
    },
    select: { id: true },
  });
  return hrEmployees.map((e) => e.id);
}

/**
 * Send a notification to multiple employee IDs, catching per-recipient
 * errors so one failure does not block the rest.
 */
async function notifyMany(
  recipientIds: string[],
  params: Omit<Parameters<typeof notify>[0], 'employeeId'>
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  await Promise.allSettled(
    unique.map((employeeId) => notify({ ...params, employeeId }))
  );
}

// ─── Job Processors ─────────────────────────────────────────────────────────

/**
 * Birthday Reminder — runs daily at 08:00 ET.
 *
 * Finds active employees whose dateOfBirth month+day matches today,
 * then notifies HR admins and the employee's direct manager.
 */
export async function processBirthdayReminder(): Promise<{
  processed: number;
}> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  const todayMonth = getMonth(now) + 1; // date-fns months are 0-indexed
  const todayDay = getDate(now);

  console.log(
    `[cron:birthday] Checking birthdays for ${todayMonth}/${todayDay}`
  );

  // Prisma does not support extracting month/day from DateTime directly.
  // Fetch all active employees with a dateOfBirth set, then filter in JS.
  // For large orgs this could be optimized with a raw query or denormalized
  // birth_month / birth_day columns, but Prisma-only is a project rule.
  const employees = await db.employee.findMany({
    where: {
      status: 'ACTIVE',
      dateOfBirth: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      companyId: true,
      reportingToId: true,
    },
  });

  const birthdayEmployees = employees.filter((emp) => {
    if (!emp.dateOfBirth) return false;
    const dob = toZonedTime(emp.dateOfBirth, SCHEDULE_TZ);
    return getMonth(dob) + 1 === todayMonth && getDate(dob) === todayDay;
  });

  console.log(
    `[cron:birthday] Found ${birthdayEmployees.length} birthday(s) today`
  );

  for (const emp of birthdayEmployees) {
    try {
      const hrIds = await getHrAdminIds(emp.companyId);
      const recipients = [...hrIds];
      if (emp.reportingToId) {
        recipients.push(emp.reportingToId);
      }

      await notifyMany(recipients, {
        type: 'BIRTHDAY',
        title: `Birthday Reminder: ${emp.firstName} ${emp.lastName}`,
        message: `Today is ${emp.firstName} ${emp.lastName}'s birthday. Wish them a happy birthday!`,
        link: `/directory/${emp.id}`,
        sendEmail: true,
      });
    } catch (err) {
      console.error(
        `[cron:birthday] Failed to notify for employee ${emp.id}:`,
        err
      );
    }
  }

  return { processed: birthdayEmployees.length };
}

/**
 * Work Anniversary Reminder — runs daily at 08:00 ET.
 *
 * Finds active employees whose joinedAt month+day matches today
 * and who have been with the company for at least one year.
 */
export async function processWorkAnniversaryReminder(): Promise<{
  processed: number;
}> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  const todayMonth = getMonth(now) + 1;
  const todayDay = getDate(now);
  const todayYear = getYear(now);

  console.log(
    `[cron:anniversary] Checking work anniversaries for ${todayMonth}/${todayDay}`
  );

  const employees = await db.employee.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      joinedAt: true,
      companyId: true,
      reportingToId: true,
    },
  });

  const anniversaryEmployees = employees.filter((emp) => {
    const joined = toZonedTime(emp.joinedAt, SCHEDULE_TZ);
    const joinedMonth = getMonth(joined) + 1;
    const joinedDay = getDate(joined);
    const joinedYear = getYear(joined);
    // Same month+day but different year (at least 1 year tenure)
    return (
      joinedMonth === todayMonth &&
      joinedDay === todayDay &&
      joinedYear !== todayYear
    );
  });

  console.log(
    `[cron:anniversary] Found ${anniversaryEmployees.length} anniversary(ies) today`
  );

  for (const emp of anniversaryEmployees) {
    try {
      const years = differenceInYears(
        now,
        toZonedTime(emp.joinedAt, SCHEDULE_TZ)
      );
      const hrIds = await getHrAdminIds(emp.companyId);
      const recipients = [...hrIds];
      if (emp.reportingToId) {
        recipients.push(emp.reportingToId);
      }

      await notifyMany(recipients, {
        type: 'WORK_ANNIVERSARY',
        title: `Work Anniversary: ${emp.firstName} ${emp.lastName}`,
        message: `${emp.firstName} ${emp.lastName} is celebrating ${years} year${years !== 1 ? 's' : ''} with the company today!`,
        link: `/directory/${emp.id}`,
        sendEmail: true,
      });
    } catch (err) {
      console.error(
        `[cron:anniversary] Failed to notify for employee ${emp.id}:`,
        err
      );
    }
  }

  return { processed: anniversaryEmployees.length };
}

/**
 * Probation Ending Reminder — runs daily at 09:00 ET.
 *
 * Finds active employees whose probationEndsAt falls within
 * the next 7 calendar days. Notifies HR and the direct manager.
 */
export async function processProbationEndingReminder(): Promise<{
  processed: number;
}> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  const rangeStart = startOfDay(now);
  const rangeEnd = endOfDay(addDays(now, 7));

  console.log(
    `[cron:probation] Checking probation endings between ${rangeStart.toISOString()} and ${rangeEnd.toISOString()}`
  );

  const employees = await db.employee.findMany({
    where: {
      status: 'ACTIVE',
      confirmedAt: null, // Not yet confirmed
      probationEndsAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      probationEndsAt: true,
      companyId: true,
      reportingToId: true,
    },
  });

  console.log(
    `[cron:probation] Found ${employees.length} probation(s) ending within 7 days`
  );

  for (const emp of employees) {
    try {
      const hrIds = await getHrAdminIds(emp.companyId);
      const recipients = [...hrIds];
      if (emp.reportingToId) {
        recipients.push(emp.reportingToId);
      }

      const endsAt = emp.probationEndsAt!;
      const daysLeft = Math.ceil(
        (endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await notifyMany(recipients, {
        type: 'PROBATION_END',
        title: `Probation Ending: ${emp.firstName} ${emp.lastName}`,
        message: `${emp.firstName} ${emp.lastName}'s probation period ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${endsAt.toLocaleDateString('en-US')}). Please schedule a confirmation review.`,
        link: `/directory/${emp.id}`,
        sendEmail: true,
      });
    } catch (err) {
      console.error(
        `[cron:probation] Failed to notify for employee ${emp.id}:`,
        err
      );
    }
  }

  return { processed: employees.length };
}

/**
 * Document Expiry Warning — runs daily at 10:00 ET.
 *
 * Finds employee documents whose expiresAt falls within the
 * next 30 calendar days. Notifies the document owner and HR.
 */
export async function processDocumentExpiryWarning(): Promise<{
  processed: number;
}> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  const rangeStart = startOfDay(now);
  const rangeEnd = endOfDay(addDays(now, 30));

  console.log(
    `[cron:doc-expiry] Checking document expirations between ${rangeStart.toISOString()} and ${rangeEnd.toISOString()}`
  );

  const documents = await db.employeeDocument.findMany({
    where: {
      expiresAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      id: true,
      name: true,
      category: true,
      expiresAt: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyId: true,
        },
      },
    },
  });

  console.log(
    `[cron:doc-expiry] Found ${documents.length} document(s) expiring within 30 days`
  );

  for (const doc of documents) {
    try {
      const hrIds = await getHrAdminIds(doc.employee.companyId);
      // Notify both the employee who owns the document and HR
      const recipients = [doc.employeeId, ...hrIds];

      const expiresAt = doc.expiresAt!;
      const daysLeft = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await notifyMany(recipients, {
        type: 'DOCUMENT_EXPIRY',
        title: `Document Expiring: ${doc.name}`,
        message: `The document "${doc.name}" (${doc.category}) for ${doc.employee.firstName} ${doc.employee.lastName} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString('en-US')}). Please upload an updated version.`,
        link: `/documents?employeeId=${doc.employeeId}`,
        sendEmail: true,
      });
    } catch (err) {
      console.error(
        `[cron:doc-expiry] Failed to notify for document ${doc.id}:`,
        err
      );
    }
  }

  return { processed: documents.length };
}

/**
 * Leave Balance Expiry Warning — runs on the 1st of each month at 09:00 ET.
 *
 * Finds employees with remaining leave balance (remaining > 0) for the
 * current fiscal year. When the current month is in the last quarter
 * of the fiscal year, sends a reminder to use or lose their leave.
 */
export async function processLeaveBalanceExpiryWarning(): Promise<{
  processed: number;
}> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  const currentYear = getYear(now);
  const currentMonth = getMonth(now) + 1; // 1-indexed

  console.log(
    `[cron:leave-balance] Checking leave balance expiry for year ${currentYear}, month ${currentMonth}`
  );

  // Fetch all companies to determine fiscal year boundaries
  const companies = await db.company.findMany({
    select: { id: true, fiscalYearStart: true },
  });

  let totalProcessed = 0;

  for (const company of companies) {
    try {
      // Determine if we are in the last quarter of the fiscal year.
      // fiscalYearStart is the month number (1-12) when the fiscal year begins.
      const fyStart = company.fiscalYearStart;
      // The fiscal year ends one month before the start of the next FY.
      // e.g., if FY starts in April (4), the last quarter is Jan-Mar (1,2,3).
      // If FY starts in January (1), the last quarter is Oct-Dec (10,11,12).
      const fyEndMonth = fyStart === 1 ? 12 : fyStart - 1;

      // Calculate months remaining in the fiscal year
      let monthsRemaining: number;
      if (currentMonth <= fyEndMonth) {
        monthsRemaining = fyEndMonth - currentMonth;
      } else {
        monthsRemaining = 12 - currentMonth + fyEndMonth;
      }

      // Only send warnings when 3 or fewer months remain in the fiscal year
      if (monthsRemaining > 3) {
        continue;
      }

      // Determine which leave balance year to query.
      // If FY starts Jan, year = currentYear.
      // If FY starts April and current month is Jan-Mar, year = currentYear - 1.
      const balanceYear =
        fyStart > 1 && currentMonth < fyStart ? currentYear - 1 : currentYear;

      const balances = await db.leaveBalance.findMany({
        where: {
          year: balanceYear,
          employee: {
            companyId: company.id,
            status: 'ACTIVE',
          },
        },
        select: {
          id: true,
          entitled: true,
          used: true,
          pending: true,
          carried: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          leaveType: {
            select: {
              name: true,
              carryForward: true,
            },
          },
        },
      });

      // Filter to balances that have remaining days and are not carry-forward
      const expiringBalances = balances.filter((b) => {
        const remaining = b.entitled + b.carried - b.used - b.pending;
        return remaining > 0 && !b.leaveType.carryForward;
      });

      // Group by employee to send a single consolidated notification
      const byEmployee = new Map<
        string,
        { employee: (typeof expiringBalances)[0]['employee']; lines: string[] }
      >();

      for (const balance of expiringBalances) {
        const remaining =
          balance.entitled + balance.carried - balance.used - balance.pending;
        const existing = byEmployee.get(balance.employee.id);
        const line = `${balance.leaveType.name}: ${remaining} day${remaining !== 1 ? 's' : ''} remaining`;
        if (existing) {
          existing.lines.push(line);
        } else {
          byEmployee.set(balance.employee.id, {
            employee: balance.employee,
            lines: [line],
          });
        }
      }

      for (const [employeeId, { employee, lines }] of byEmployee) {
        try {
          await notify({
            employeeId,
            type: 'GENERAL',
            title: 'Leave Balance Expiry Reminder',
            message: `You have unused leave that will expire at the end of the fiscal year (${monthsRemaining} month${monthsRemaining !== 1 ? 's' : ''} remaining):\n\n${lines.join('\n')}\n\nPlease plan your time off accordingly.`,
            link: '/leave',
            sendEmail: true,
          });
          totalProcessed++;
        } catch (err) {
          console.error(
            `[cron:leave-balance] Failed to notify employee ${employeeId}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error(
        `[cron:leave-balance] Failed to process company ${company.id}:`,
        err
      );
    }
  }

  console.log(
    `[cron:leave-balance] Notified ${totalProcessed} employee(s) about expiring leave`
  );
  return { processed: totalProcessed };
}

// ─── Processor Router ───────────────────────────────────────────────────────

/**
 * Route a cron job to its processor based on jobType.
 * Registered as the queue processor in workers.ts.
 */
export async function processCronJob(
  job: Queue.Job<CronJobData>
): Promise<unknown> {
  const { jobType, scheduledAt } = job.data;
  console.log(
    `[cron] Processing ${jobType} (scheduled: ${scheduledAt}, attempt: ${job.attemptsMade + 1})`
  );

  switch (jobType) {
    case 'birthday-reminder':
      return await processBirthdayReminder();
    case 'work-anniversary-reminder':
      return await processWorkAnniversaryReminder();
    case 'probation-ending-reminder':
      return await processProbationEndingReminder();
    case 'document-expiry-warning':
      return await processDocumentExpiryWarning();
    case 'leave-balance-expiry-warning':
      return await processLeaveBalanceExpiryWarning();
    default:
      throw new Error(`[cron] Unknown job type: ${jobType}`);
  }
}

// ─── Registration ───────────────────────────────────────────────────────────

interface CronSchedule {
  jobType: CronJobData['jobType'];
  /** Cron expression (UTC) */
  cron: string;
  /** Human-readable description for logging */
  description: string;
}

/**
 * All scheduled cron jobs. Cron expressions are in UTC.
 *
 * ET offset: UTC-5 (EST) / UTC-4 (EDT). These expressions target
 * approximate ET hours assuming EST. For production, consider adjusting
 * seasonally or using a TZ-aware scheduler.
 *
 * 08:00 ET (EST) = 13:00 UTC
 * 09:00 ET (EST) = 14:00 UTC
 * 10:00 ET (EST) = 15:00 UTC
 */
const CRON_SCHEDULES: CronSchedule[] = [
  {
    jobType: 'birthday-reminder',
    cron: '0 13 * * *', // Daily at 08:00 ET (13:00 UTC)
    description: 'Birthday reminder — daily at 08:00 ET',
  },
  {
    jobType: 'work-anniversary-reminder',
    cron: '0 13 * * *', // Daily at 08:00 ET (13:00 UTC)
    description: 'Work anniversary reminder — daily at 08:00 ET',
  },
  {
    jobType: 'probation-ending-reminder',
    cron: '0 14 * * *', // Daily at 09:00 ET (14:00 UTC)
    description: 'Probation ending reminder — daily at 09:00 ET',
  },
  {
    jobType: 'document-expiry-warning',
    cron: '0 15 * * *', // Daily at 10:00 ET (15:00 UTC)
    description: 'Document expiry warning — daily at 10:00 ET',
  },
  {
    jobType: 'leave-balance-expiry-warning',
    cron: '0 14 1 * *', // 1st of month at 09:00 ET (14:00 UTC)
    description: 'Leave balance expiry warning — 1st of month at 09:00 ET',
  },
];

/**
 * Register all repeatable cron jobs on the cron queue.
 *
 * This function is idempotent — Bull de-duplicates repeatable jobs by
 * their cron expression + job name. Safe to call on every worker startup.
 *
 * Call this once during application bootstrap (e.g., in the worker
 * entrypoint or a startup script).
 */
export async function registerCronJobs(): Promise<void> {
  console.log('[cron] Registering cron jobs...');

  // Clean up any stale repeatable jobs that are no longer in the schedule
  const existingRepeatables = await cronQueue.getRepeatableJobs();
  const activeKeys = new Set(
    CRON_SCHEDULES.map((s) => s.jobType)
  );

  for (const existing of existingRepeatables) {
    if (!activeKeys.has(existing.name as CronJobData['jobType'])) {
      console.log(`[cron] Removing stale repeatable job: ${existing.name}`);
      await cronQueue.removeRepeatableByKey(existing.key);
    }
  }

  // Register each scheduled job
  for (const schedule of CRON_SCHEDULES) {
    await cronQueue.add(
      schedule.jobType, // named job for de-duplication
      {
        jobType: schedule.jobType,
        scheduledAt: new Date().toISOString(),
      },
      {
        repeat: { cron: schedule.cron },
        jobId: schedule.jobType, // stable ID prevents duplicates
      }
    );
    console.log(`[cron] Registered: ${schedule.description}`);
  }

  console.log(
    `[cron] All ${CRON_SCHEDULES.length} cron jobs registered successfully`
  );
}
