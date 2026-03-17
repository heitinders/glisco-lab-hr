/**
 * FMLA (Family and Medical Leave Act) Compliance Module
 *
 * The FMLA entitles eligible employees of covered employers to take unpaid,
 * job-protected leave for specified family and medical reasons. Eligible
 * employees are entitled to 12 workweeks of leave in a 12-month period.
 *
 * Reference: https://www.dol.gov/agencies/whd/fmla
 */

interface FMLAEligibilityInput {
  /** Employee's hire date */
  joinedAt: Date;
  /** Total hours worked in the last 12 months */
  hoursWorkedLast12Months: number;
  /** Number of employees at the worksite (within 75-mile radius) */
  employeesAtWorksite: number;
  /** Date to check eligibility against (defaults to today) */
  asOfDate?: Date;
}

interface FMLAEligibilityResult {
  /** Whether the employee is eligible for FMLA leave */
  eligible: boolean;
  /** Reasons why the employee is not eligible (if applicable) */
  reasons: string[];
  /** Remaining FMLA days available in the current 12-month period */
  remainingDays?: number;
  /** Date when the employee will become eligible (if not yet eligible) */
  eligibleDate?: Date;
}

/**
 * Check if an employee is eligible for FMLA leave.
 *
 * Eligibility requires:
 * 1. Worked for the employer for at least 12 months (not necessarily consecutive)
 * 2. Worked at least 1,250 hours during the 12-month period prior to leave
 * 3. Employed at a worksite where 50+ employees are within 75 miles
 */
export function checkFMLAEligibility(
  input: FMLAEligibilityInput
): FMLAEligibilityResult {
  const {
    joinedAt,
    hoursWorkedLast12Months,
    employeesAtWorksite,
    asOfDate = new Date(),
  } = input;

  const reasons: string[] = [];

  // Check 12-month employment requirement
  const monthsEmployed = getMonthsDifference(joinedAt, asOfDate);
  if (monthsEmployed < 12) {
    const eligibleDate = new Date(joinedAt);
    eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);
    reasons.push(
      `Employee has only been employed for ${monthsEmployed} months. 12 months required.`
    );
  }

  // Check 1,250 hours requirement
  const MINIMUM_HOURS = 1250;
  if (hoursWorkedLast12Months < MINIMUM_HOURS) {
    reasons.push(
      `Employee has worked ${hoursWorkedLast12Months} hours in the last 12 months. ${MINIMUM_HOURS} hours required.`
    );
  }

  // Check 50-employee worksite requirement
  const MINIMUM_EMPLOYEES = 50;
  if (employeesAtWorksite < MINIMUM_EMPLOYEES) {
    reasons.push(
      `Worksite has ${employeesAtWorksite} employees within 75 miles. ${MINIMUM_EMPLOYEES} required.`
    );
  }

  const eligible = reasons.length === 0;

  // Calculate eligible date if not yet eligible
  let eligibleDate: Date | undefined;
  if (!eligible && monthsEmployed < 12) {
    eligibleDate = new Date(joinedAt);
    eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);
  }

  return {
    eligible,
    reasons,
    remainingDays: eligible ? 60 : undefined, // 12 weeks = 60 workdays
    eligibleDate,
  };
}

/**
 * Calculate the number of FMLA workdays used in the current 12-month period.
 *
 * Uses the "rolling" 12-month period measured backward from the date
 * an employee uses any FMLA leave.
 */
export function calculateFMLAUsage(
  leaveDays: { startDate: Date; endDate: Date; totalDays: number }[],
  asOfDate: Date = new Date()
): {
  usedDays: number;
  remainingDays: number;
  maxDays: number;
} {
  const MAX_FMLA_WORKDAYS = 60; // 12 weeks x 5 days

  const twelveMonthsAgo = new Date(asOfDate);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const usedDays = leaveDays
    .filter(
      (leave) =>
        leave.startDate >= twelveMonthsAgo && leave.startDate <= asOfDate
    )
    .reduce((sum, leave) => sum + leave.totalDays, 0);

  return {
    usedDays,
    remainingDays: Math.max(0, MAX_FMLA_WORKDAYS - usedDays),
    maxDays: MAX_FMLA_WORKDAYS,
  };
}

function getMonthsDifference(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}
