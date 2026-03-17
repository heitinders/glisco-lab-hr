/**
 * New Jersey Labor Law Compliance Module
 *
 * Implements NJ Earned Sick Leave Act (NJSA 34:11D-1 et seq.)
 * and other NJ-specific labor regulations.
 *
 * Reference: https://www.nj.gov/labor/worker-protections/earnedsick/
 */

interface NJSickLeaveInput {
  /** Employee's start date */
  joinedAt: Date;
  /** Hours worked since start date or since last accrual reset */
  hoursWorked: number;
  /** Sick leave hours already accrued */
  accruedHours: number;
  /** Sick leave hours already used this benefit year */
  usedHours: number;
  /** Whether the employer front-loads sick leave */
  isFrontLoaded: boolean;
}

interface NJSickLeaveResult {
  /** Total accrued sick leave hours */
  accruedHours: number;
  /** Remaining available sick leave hours */
  availableHours: number;
  /** Equivalent days (assuming 8-hour workday) */
  availableDays: number;
  /** Maximum allowed accrual */
  maxAccrual: number;
  /** Maximum annual usage */
  maxAnnualUsage: number;
}

/**
 * Calculate NJ Earned Sick Leave accrual and availability.
 *
 * Under the NJ Earned Sick Leave Act:
 * - Employees earn 1 hour of sick leave for every 30 hours worked
 * - Maximum accrual: 40 hours per benefit year
 * - Employers may front-load 40 hours at the start of the benefit year
 * - Up to 40 hours can be carried over to the next benefit year
 * - Employees can use sick leave beginning on the 120th calendar day after hire
 */
export function calculateNJSickLeave(input: NJSickLeaveInput): NJSickLeaveResult {
  const {
    hoursWorked,
    accruedHours: currentAccrued,
    usedHours,
    isFrontLoaded,
  } = input;

  const MAX_ACCRUAL = 40; // 40 hours per benefit year
  const MAX_ANNUAL_USAGE = 40; // 40 hours per benefit year
  const ACCRUAL_RATE = 1 / 30; // 1 hour per 30 hours worked

  let totalAccrued: number;

  if (isFrontLoaded) {
    // Employer front-loads full 40 hours at start of benefit year
    totalAccrued = MAX_ACCRUAL;
  } else {
    // Standard accrual: 1 hour per 30 hours worked
    const newAccrual = Math.floor(hoursWorked * ACCRUAL_RATE);
    totalAccrued = Math.min(currentAccrued + newAccrual, MAX_ACCRUAL);
  }

  const availableHours = Math.min(
    totalAccrued - usedHours,
    MAX_ANNUAL_USAGE - usedHours
  );

  return {
    accruedHours: totalAccrued,
    availableHours: Math.max(0, availableHours),
    availableDays: Math.max(0, availableHours / 8),
    maxAccrual: MAX_ACCRUAL,
    maxAnnualUsage: MAX_ANNUAL_USAGE,
  };
}

/**
 * Check if an employee is eligible to start using NJ sick leave.
 *
 * Employees can begin using earned sick leave on the 120th calendar day
 * after the employee commences employment.
 */
export function isEligibleForNJSickLeave(
  joinedAt: Date,
  asOfDate: Date = new Date()
): {
  eligible: boolean;
  eligibleDate: Date;
  daysUntilEligible: number;
} {
  const WAITING_PERIOD_DAYS = 120;

  const eligibleDate = new Date(joinedAt);
  eligibleDate.setDate(eligibleDate.getDate() + WAITING_PERIOD_DAYS);

  const eligible = asOfDate >= eligibleDate;
  const daysUntilEligible = eligible
    ? 0
    : Math.ceil(
        (eligibleDate.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24)
      );

  return {
    eligible,
    eligibleDate,
    daysUntilEligible,
  };
}

/**
 * Calculate NJ overtime pay rate.
 *
 * NJ minimum wage and overtime rules:
 * - Overtime rate: 1.5x regular rate for hours over 40 in a workweek
 * - NJ minimum wage (2025): $15.49/hour for most employers
 */
export function calculateNJOvertime(
  hoursWorked: number,
  hourlyRate: number
): {
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  overtimeHours: number;
} {
  const OVERTIME_THRESHOLD = 40;
  const OVERTIME_MULTIPLIER = 1.5;

  const regularHours = Math.min(hoursWorked, OVERTIME_THRESHOLD);
  const overtimeHours = Math.max(0, hoursWorked - OVERTIME_THRESHOLD);

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;

  return {
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalPay: Math.round((regularPay + overtimePay) * 100) / 100,
    overtimeHours,
  };
}
