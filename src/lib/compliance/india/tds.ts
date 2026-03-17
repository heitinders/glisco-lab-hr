/**
 * Indian TDS (Tax Deducted at Source) Compliance Module
 *
 * Implements income tax calculations for salaried employees under
 * the Income Tax Act, 1961. Supports both Old and New Tax Regimes.
 *
 * Reference: https://www.incometax.gov.in/
 * FY 2024-25 (AY 2025-26) rates
 */

type TaxRegime = 'OLD' | 'NEW';

interface TDSInput {
  /** Annual gross salary in INR */
  annualGrossSalary: number;
  /** Annual HRA received (for old regime exemption) */
  annualHRA?: number;
  /** Annual rent paid (for HRA exemption calculation) */
  annualRentPaid?: number;
  /** Whether the employee lives in a metro city (Delhi, Mumbai, Kolkata, Chennai) */
  isMetroCity?: boolean;
  /** Investments under Section 80C (PPF, ELSS, LIC, etc.) */
  section80C?: number;
  /** Health insurance premium under Section 80D */
  section80D?: number;
  /** Home loan interest under Section 24 */
  homeLoanInterest?: number;
  /** NPS contribution under Section 80CCD(1B) */
  npsContribution?: number;
  /** Standard deduction amount */
  standardDeduction?: number;
  /** Employee PF contribution (annual) */
  employeePF?: number;
  /** Professional tax (annual) */
  professionalTax?: number;
  /** Tax regime choice */
  regime?: TaxRegime;
}

interface TDSResult {
  /** Gross salary */
  grossSalary: number;
  /** Total exemptions and deductions */
  totalDeductions: number;
  /** Taxable income after deductions */
  taxableIncome: number;
  /** Income tax computed on taxable income */
  incomeTax: number;
  /** Health and Education Cess (4%) */
  cess: number;
  /** Surcharge (if applicable) */
  surcharge: number;
  /** Total tax liability */
  totalTax: number;
  /** Monthly TDS to be deducted */
  monthlyTDS: number;
  /** Effective tax rate percentage */
  effectiveTaxRate: number;
  /** Tax regime used */
  regime: TaxRegime;
  /** Breakdown of deductions */
  deductionBreakdown: Record<string, number>;
}

/**
 * New Tax Regime slabs for FY 2024-25 (after Budget 2024)
 */
const NEW_REGIME_SLABS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 700000, rate: 0.05 },
  { min: 700000, max: 1000000, rate: 0.1 },
  { min: 1000000, max: 1200000, rate: 0.15 },
  { min: 1200000, max: 1500000, rate: 0.2 },
  { min: 1500000, max: Infinity, rate: 0.3 },
];

/**
 * Old Tax Regime slabs for FY 2024-25
 */
const OLD_REGIME_SLABS = [
  { min: 0, max: 250000, rate: 0 },
  { min: 250000, max: 500000, rate: 0.05 },
  { min: 500000, max: 1000000, rate: 0.2 },
  { min: 1000000, max: Infinity, rate: 0.3 },
];

/**
 * Section 80C maximum deduction limit
 */
const SECTION_80C_LIMIT = 150000;

/**
 * Standard deduction for salaried employees
 */
const STANDARD_DEDUCTION_OLD = 50000;
const STANDARD_DEDUCTION_NEW = 75000; // Updated in Budget 2024

/**
 * Calculate TDS (Tax Deducted at Source) for a salaried employee.
 *
 * Computes annual tax liability and derives monthly TDS amount.
 * Supports both Old and New Tax Regimes with all applicable deductions.
 */
export function calculateTDS(input: TDSInput): TDSResult {
  const {
    annualGrossSalary,
    annualHRA = 0,
    annualRentPaid = 0,
    isMetroCity = false,
    section80C = 0,
    section80D = 0,
    homeLoanInterest = 0,
    npsContribution = 0,
    employeePF = 0,
    professionalTax = 0,
    regime = 'NEW',
  } = input;

  const deductionBreakdown: Record<string, number> = {};
  let totalDeductions = 0;

  if (regime === 'OLD') {
    // Standard deduction
    const stdDeduction = STANDARD_DEDUCTION_OLD;
    deductionBreakdown['Standard Deduction'] = stdDeduction;
    totalDeductions += stdDeduction;

    // HRA exemption
    if (annualHRA > 0 && annualRentPaid > 0) {
      const hraExemption = calculateHRAExemption(
        annualGrossSalary * 0.4, // Approximate basic as 40% of gross
        annualHRA,
        annualRentPaid,
        isMetroCity
      );
      deductionBreakdown['HRA Exemption'] = hraExemption;
      totalDeductions += hraExemption;
    }

    // Section 80C (PF + other investments, capped at 1.5L)
    const total80C = Math.min(section80C + employeePF, SECTION_80C_LIMIT);
    if (total80C > 0) {
      deductionBreakdown['Section 80C'] = total80C;
      totalDeductions += total80C;
    }

    // Section 80D (Health insurance)
    if (section80D > 0) {
      const capped80D = Math.min(section80D, 75000); // Max including parents
      deductionBreakdown['Section 80D'] = capped80D;
      totalDeductions += capped80D;
    }

    // Section 24 (Home loan interest)
    if (homeLoanInterest > 0) {
      const cappedInterest = Math.min(homeLoanInterest, 200000);
      deductionBreakdown['Home Loan Interest (Sec 24)'] = cappedInterest;
      totalDeductions += cappedInterest;
    }

    // Section 80CCD(1B) - NPS
    if (npsContribution > 0) {
      const cappedNPS = Math.min(npsContribution, 50000);
      deductionBreakdown['NPS (Sec 80CCD(1B))'] = cappedNPS;
      totalDeductions += cappedNPS;
    }

    // Professional tax
    if (professionalTax > 0) {
      deductionBreakdown['Professional Tax'] = professionalTax;
      totalDeductions += professionalTax;
    }
  } else {
    // New Regime: only standard deduction allowed
    const stdDeduction = STANDARD_DEDUCTION_NEW;
    deductionBreakdown['Standard Deduction'] = stdDeduction;
    totalDeductions = stdDeduction;
  }

  // Calculate taxable income
  const taxableIncome = Math.max(0, annualGrossSalary - totalDeductions);

  // Calculate tax based on slabs
  const slabs = regime === 'OLD' ? OLD_REGIME_SLABS : NEW_REGIME_SLABS;
  const incomeTax = calculateSlabTax(taxableIncome, slabs);

  // Apply Section 87A rebate (New regime: taxable income <= 7L, rebate up to 25000)
  let taxAfterRebate = incomeTax;
  if (regime === 'NEW' && taxableIncome <= 700000) {
    taxAfterRebate = Math.max(0, incomeTax - 25000);
  } else if (regime === 'OLD' && taxableIncome <= 500000) {
    taxAfterRebate = Math.max(0, incomeTax - 12500);
  }

  // Surcharge
  const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome);

  // Health and Education Cess: 4%
  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);

  const totalTax = taxAfterRebate + surcharge + cess;
  const monthlyTDS = Math.round(totalTax / 12);

  const effectiveTaxRate =
    annualGrossSalary > 0
      ? Math.round((totalTax / annualGrossSalary) * 10000) / 100
      : 0;

  return {
    grossSalary: annualGrossSalary,
    totalDeductions,
    taxableIncome,
    incomeTax: taxAfterRebate,
    cess,
    surcharge,
    totalTax,
    monthlyTDS,
    effectiveTaxRate,
    regime,
    deductionBreakdown,
  };
}

/**
 * Compare tax liability under both regimes to help employee choose.
 */
export function compareTaxRegimes(input: Omit<TDSInput, 'regime'>): {
  oldRegime: TDSResult;
  newRegime: TDSResult;
  recommendation: TaxRegime;
  savings: number;
} {
  const oldRegime = calculateTDS({ ...input, regime: 'OLD' });
  const newRegime = calculateTDS({ ...input, regime: 'NEW' });

  const recommendation =
    oldRegime.totalTax <= newRegime.totalTax ? 'OLD' : 'NEW';
  const savings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

  return { oldRegime, newRegime, recommendation, savings };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function calculateSlabTax(
  income: number,
  slabs: { min: number; max: number; rate: number }[]
): number {
  let tax = 0;
  for (const slab of slabs) {
    if (income <= slab.min) break;
    const taxableInSlab = Math.min(income, slab.max) - slab.min;
    tax += taxableInSlab * slab.rate;
  }
  return Math.round(tax);
}

function calculateHRAExemption(
  basicSalary: number,
  hraReceived: number,
  rentPaid: number,
  isMetro: boolean
): number {
  const hraPercentage = isMetro ? 0.5 : 0.4;

  // HRA exemption is the minimum of:
  // 1. Actual HRA received
  // 2. 50% (metro) or 40% (non-metro) of basic salary
  // 3. Rent paid - 10% of basic salary
  const exemption = Math.min(
    hraReceived,
    basicSalary * hraPercentage,
    Math.max(0, rentPaid - basicSalary * 0.1)
  );

  return Math.round(Math.max(0, exemption));
}

function calculateSurcharge(tax: number, income: number): number {
  if (income > 50000000) {
    return Math.round(tax * 0.37); // 37% for income > 5 Cr
  } else if (income > 20000000) {
    return Math.round(tax * 0.25); // 25% for income > 2 Cr
  } else if (income > 10000000) {
    return Math.round(tax * 0.15); // 15% for income > 1 Cr
  } else if (income > 5000000) {
    return Math.round(tax * 0.1); // 10% for income > 50L
  }
  return 0;
}
