/**
 * Indian Gratuity Compliance Module
 *
 * Implements gratuity calculations under the Payment of Gratuity Act, 1972.
 * Gratuity is payable to an employee upon termination of employment after
 * completing 5 years of continuous service.
 *
 * Reference: https://labour.gov.in/payment-of-gratuity-act-1972
 */

interface GratuityInput {
  /** Monthly basic salary in INR (last drawn) */
  lastDrawnBasicSalary: number;
  /** Monthly Dearness Allowance in INR (last drawn) */
  lastDrawnDA: number;
  /** Total years of continuous service */
  yearsOfService: number;
  /** Total months beyond complete years (for rounding) */
  additionalMonths: number;
  /** Whether the employee is covered under the Act (10+ employees) */
  isCoveredEstablishment?: boolean;
}

interface GratuityResult {
  /** Whether the employee is eligible for gratuity */
  eligible: boolean;
  /** Calculated gratuity amount in INR */
  gratuityAmount: number;
  /** Maximum gratuity payable under the Act */
  maxGratuity: number;
  /** Final gratuity (min of calculated and max) */
  payableAmount: number;
  /** Completed years of service used in calculation */
  completedYears: number;
  /** Reason if not eligible */
  reason?: string;
}

/**
 * Maximum gratuity limit as per the Act (updated 2019)
 */
const MAX_GRATUITY = 2000000; // Rs. 20 lakh

/**
 * Minimum years of service required for gratuity eligibility
 */
const MIN_SERVICE_YEARS = 5;

/**
 * Calculate gratuity for an employee under the Payment of Gratuity Act, 1972.
 *
 * Formula: Gratuity = (Last drawn salary x 15 x Years of service) / 26
 *
 * Where:
 * - Last drawn salary = Basic + DA
 * - 15 = number of days salary considered per year
 * - 26 = number of working days in a month
 * - Years of service rounded up if > 6 months beyond a complete year
 */
export function calculateGratuity(input: GratuityInput): GratuityResult {
  const {
    lastDrawnBasicSalary,
    lastDrawnDA,
    yearsOfService,
    additionalMonths,
    isCoveredEstablishment = true,
  } = input;

  // Round years of service: if additional months > 6, count as next year
  const completedYears =
    additionalMonths > 6 ? yearsOfService + 1 : yearsOfService;

  // Check eligibility
  if (!isCoveredEstablishment) {
    return {
      eligible: false,
      gratuityAmount: 0,
      maxGratuity: MAX_GRATUITY,
      payableAmount: 0,
      completedYears,
      reason:
        'Establishment is not covered under the Payment of Gratuity Act (requires 10+ employees)',
    };
  }

  if (completedYears < MIN_SERVICE_YEARS) {
    return {
      eligible: false,
      gratuityAmount: 0,
      maxGratuity: MAX_GRATUITY,
      payableAmount: 0,
      completedYears,
      reason: `Minimum ${MIN_SERVICE_YEARS} years of continuous service required. Current: ${yearsOfService} years and ${additionalMonths} months.`,
    };
  }

  // Calculate gratuity
  const lastDrawnSalary = lastDrawnBasicSalary + lastDrawnDA;
  const gratuityAmount = Math.round(
    (lastDrawnSalary * 15 * completedYears) / 26
  );

  const payableAmount = Math.min(gratuityAmount, MAX_GRATUITY);

  return {
    eligible: true,
    gratuityAmount,
    maxGratuity: MAX_GRATUITY,
    payableAmount,
    completedYears,
  };
}

/**
 * Calculate gratuity for death/disability cases.
 *
 * In case of death or disablement, the 5-year service requirement is waived.
 * The gratuity is calculated on a sliding scale based on years of service.
 */
export function calculateDeathGratuity(
  lastDrawnBasicSalary: number,
  lastDrawnDA: number,
  yearsOfService: number
): number {
  const lastDrawnSalary = lastDrawnBasicSalary + lastDrawnDA;

  // Sliding scale for death gratuity
  let multiplier: number;
  if (yearsOfService < 1) {
    multiplier = 2;
  } else if (yearsOfService < 5) {
    multiplier = 6;
  } else if (yearsOfService < 11) {
    multiplier = 12;
  } else if (yearsOfService < 20) {
    multiplier = 20;
  } else {
    // Half month's salary for every completed year, subject to max 33x
    multiplier = Math.min(yearsOfService * 0.5 * 2, 33);
  }

  const gratuity = Math.round(lastDrawnSalary * multiplier);
  return Math.min(gratuity, MAX_GRATUITY);
}
