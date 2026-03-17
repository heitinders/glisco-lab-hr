/**
 * Payroll Calculation Engine
 *
 * Calculates payslip breakdowns for both India and US regions.
 * Uses compliance modules for PF, ESI, TDS (India) and
 * Federal/State tax, SS, Medicare (US).
 */

import { calculatePF } from '@/lib/compliance/india/pf';
import { calculateTDS } from '@/lib/compliance/india/tds';
import type { Decimal } from '@prisma/client/runtime/library';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployeePayrollInput {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  region: 'US' | 'INDIA';
  /** Annual CTC (India) or Annual Salary (US) from SalaryHistory */
  annualSalary: number;
  /** City for HRA metro determination (India) */
  workLocation?: string | null;
  /** Employee PF contribution opt-out (India) */
  pfOptOut?: boolean;
  /** Employee 401k contribution percentage (US) */
  retirement401kPercent?: number;
  /** Additional pre-tax deductions (health insurance, etc.) */
  preTaxDeductions?: number;
  /** Overtime pay for the month */
  overtimePay?: number;
  /** Bonus for the month */
  bonus?: number;
  /** Leave days taken (unpaid leave deduction) */
  unpaidLeaveDays?: number;
  /** Total working days in the month */
  workingDaysInMonth?: number;
}

export interface AllowanceItem {
  label: string;
  amount: number;
}

export interface DeductionItem {
  label: string;
  amount: number;
}

export interface PayslipBreakdown {
  employeeId: string;
  period: string;
  currency: string;
  basicSalary: number;
  hra: number | null;
  allowances: AllowanceItem[];
  deductions: DeductionItem[];
  grossPay: number;
  taxDeducted: number;
  stateTax: number | null;
  pf: number | null;
  esi: number | null;
  netPay: number;
  leaveDays: number;
  overtimePay: number;
  bonuses: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const METRO_CITIES = ['mumbai', 'delhi', 'kolkata', 'chennai', 'bengaluru', 'hyderabad', 'pune'];

/** India ESI threshold: gross monthly wages <= 21,000 */
const ESI_THRESHOLD = 21000;
const ESI_EMPLOYEE_RATE = 0.0075; // 0.75%
const ESI_EMPLOYER_RATE = 0.0325; // 3.25%

/** India Professional Tax (Maharashtra standard, most states similar) */
const PROFESSIONAL_TAX_MONTHLY = 200;

/** US Social Security wage base for 2025 */
const SS_WAGE_BASE = 168600;
const SS_RATE = 0.062; // 6.2%
const MEDICARE_RATE = 0.0145; // 1.45%
const MEDICARE_ADDITIONAL_THRESHOLD = 200000;
const MEDICARE_ADDITIONAL_RATE = 0.009; // 0.9%

// ─── Main Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate payslip for a single employee for a given month/year.
 */
export function calculatePayslip(
  employee: EmployeePayrollInput,
  month: number,
  year: number
): PayslipBreakdown {
  const period = `${year}-${String(month).padStart(2, '0')}`;

  if (employee.region === 'INDIA') {
    return calculateIndiaPayslip(employee, period);
  }
  return calculateUSPayslip(employee, period);
}

// ─── India Payslip ───────────────────────────────────────────────────────────

function calculateIndiaPayslip(
  emp: EmployeePayrollInput,
  period: string
): PayslipBreakdown {
  const annualCTC = emp.annualSalary;
  const monthlyCTC = annualCTC / 12;

  // Salary structure: Basic = 40% of CTC, HRA = 50% of Basic (metro) or 40% (non-metro)
  const isMetro = emp.workLocation
    ? METRO_CITIES.some((c) => emp.workLocation!.toLowerCase().includes(c))
    : false;

  const annualBasic = annualCTC * 0.4;
  const monthlyBasic = Math.round(annualBasic / 12);
  const hraPercent = isMetro ? 0.5 : 0.4;
  const monthlyHRA = Math.round(monthlyBasic * hraPercent);
  const monthlySpecialAllowance = Math.round(monthlyCTC - monthlyBasic - monthlyHRA);

  // Gross earnings
  let grossEarnings = monthlyBasic + monthlyHRA + monthlySpecialAllowance;

  // Add overtime and bonus
  const overtime = emp.overtimePay ?? 0;
  const bonus = emp.bonus ?? 0;
  grossEarnings += overtime + bonus;

  // Unpaid leave deduction
  const workingDays = emp.workingDaysInMonth ?? 22;
  const unpaidDays = emp.unpaidLeaveDays ?? 0;
  const leaveDeduction = unpaidDays > 0
    ? Math.round((grossEarnings / workingDays) * unpaidDays)
    : 0;
  grossEarnings -= leaveDeduction;

  // Allowances
  const allowances: AllowanceItem[] = [
    { label: 'Special Allowance', amount: monthlySpecialAllowance },
  ];
  if (overtime > 0) allowances.push({ label: 'Overtime', amount: overtime });
  if (bonus > 0) allowances.push({ label: 'Bonus', amount: bonus });

  // Deductions
  const deductions: DeductionItem[] = [];

  // PF deduction
  let pfDeduction = 0;
  if (!emp.pfOptOut) {
    const pfResult = calculatePF({
      basicSalary: monthlyBasic,
      dearnessAllowance: 0,
    });
    pfDeduction = pfResult.employeeContribution;
    deductions.push({ label: 'Provident Fund (EPF)', amount: pfDeduction });
  }

  // ESI deduction (only if gross <= 21000)
  let esiDeduction = 0;
  if (grossEarnings <= ESI_THRESHOLD) {
    esiDeduction = Math.round(grossEarnings * ESI_EMPLOYEE_RATE);
    deductions.push({ label: 'ESI', amount: esiDeduction });
  }

  // Professional Tax
  const professionalTax = PROFESSIONAL_TAX_MONTHLY;
  deductions.push({ label: 'Professional Tax', amount: professionalTax });

  // TDS (Income Tax)
  const tdsResult = calculateTDS({
    annualGrossSalary: annualCTC,
    employeePF: pfDeduction * 12,
    professionalTax: professionalTax * 12,
    regime: 'NEW',
  });
  const monthlyTDS = tdsResult.monthlyTDS;
  deductions.push({ label: 'TDS (Income Tax)', amount: monthlyTDS });

  // Leave deduction
  if (leaveDeduction > 0) {
    deductions.push({ label: 'Unpaid Leave', amount: leaveDeduction });
  }

  const totalDeductions = pfDeduction + esiDeduction + professionalTax + monthlyTDS + leaveDeduction;
  const netPay = grossEarnings - totalDeductions;

  return {
    employeeId: emp.id,
    period,
    currency: 'INR',
    basicSalary: monthlyBasic,
    hra: monthlyHRA,
    allowances,
    deductions,
    grossPay: grossEarnings,
    taxDeducted: monthlyTDS,
    stateTax: null,
    pf: pfDeduction > 0 ? pfDeduction : null,
    esi: esiDeduction > 0 ? esiDeduction : null,
    netPay: Math.round(netPay),
    leaveDays: unpaidDays,
    overtimePay: overtime,
    bonuses: bonus,
  };
}

// ─── US Payslip ──────────────────────────────────────────────────────────────

function calculateUSPayslip(
  emp: EmployeePayrollInput,
  period: string
): PayslipBreakdown {
  const annualSalary = emp.annualSalary;
  const monthlyGross = Math.round(annualSalary / 12);

  let grossEarnings = monthlyGross;

  // Add overtime and bonus
  const overtime = emp.overtimePay ?? 0;
  const bonus = emp.bonus ?? 0;
  grossEarnings += overtime + bonus;

  // Unpaid leave deduction
  const workingDays = emp.workingDaysInMonth ?? 22;
  const unpaidDays = emp.unpaidLeaveDays ?? 0;
  const leaveDeduction = unpaidDays > 0
    ? Math.round((grossEarnings / workingDays) * unpaidDays)
    : 0;
  grossEarnings -= leaveDeduction;

  const allowances: AllowanceItem[] = [];
  if (overtime > 0) allowances.push({ label: 'Overtime', amount: overtime });
  if (bonus > 0) allowances.push({ label: 'Bonus', amount: bonus });

  const deductions: DeductionItem[] = [];

  // Pre-tax deductions (health insurance, FSA, etc.)
  const preTax = emp.preTaxDeductions ?? 0;
  if (preTax > 0) {
    deductions.push({ label: 'Pre-Tax Deductions', amount: preTax });
  }

  const taxableMonthly = grossEarnings - preTax;
  const taxableAnnual = taxableMonthly * 12;

  // Federal income tax (2025 brackets, single filer, simplified)
  const annualFederalTax = calculateFederalTax(taxableAnnual);
  const monthlyFederalTax = Math.round(annualFederalTax / 12);
  deductions.push({ label: 'Federal Income Tax', amount: monthlyFederalTax });

  // NJ State income tax
  const annualStateTax = calculateNJStateTax(taxableAnnual);
  const monthlyStateTax = Math.round(annualStateTax / 12);
  deductions.push({ label: 'NJ State Tax', amount: monthlyStateTax });

  // Social Security (6.2% up to wage base)
  const monthlySSWageBase = SS_WAGE_BASE / 12;
  const ssSubject = Math.min(grossEarnings, monthlySSWageBase);
  const ssTax = Math.round(ssSubject * SS_RATE);
  deductions.push({ label: 'Social Security', amount: ssTax });

  // Medicare (1.45%, additional 0.9% over $200k annual)
  let medicareTax = Math.round(grossEarnings * MEDICARE_RATE);
  if (annualSalary > MEDICARE_ADDITIONAL_THRESHOLD) {
    medicareTax += Math.round(grossEarnings * MEDICARE_ADDITIONAL_RATE);
  }
  deductions.push({ label: 'Medicare', amount: medicareTax });

  // 401k contribution
  const retirementPercent = emp.retirement401kPercent ?? 0;
  const retirement401k = Math.round(grossEarnings * (retirementPercent / 100));
  if (retirement401k > 0) {
    deductions.push({ label: '401(k) Contribution', amount: retirement401k });
  }

  // Leave deduction
  if (leaveDeduction > 0) {
    deductions.push({ label: 'Unpaid Leave', amount: leaveDeduction });
  }

  const totalDeductions =
    preTax + monthlyFederalTax + monthlyStateTax + ssTax + medicareTax + retirement401k + leaveDeduction;
  const netPay = grossEarnings - totalDeductions;

  return {
    employeeId: emp.id,
    period,
    currency: 'USD',
    basicSalary: monthlyGross,
    hra: null,
    allowances,
    deductions,
    grossPay: grossEarnings,
    taxDeducted: monthlyFederalTax,
    stateTax: monthlyStateTax,
    pf: null,
    esi: null,
    netPay: Math.round(netPay),
    leaveDays: unpaidDays,
    overtimePay: overtime,
    bonuses: bonus,
  };
}

// ─── US Tax Helpers ──────────────────────────────────────────────────────────

/**
 * Simplified 2025 Federal income tax brackets (single filer).
 */
function calculateFederalTax(annualIncome: number): number {
  const brackets = [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ];

  // Standard deduction for 2025
  const standardDeduction = 15000;
  const taxable = Math.max(0, annualIncome - standardDeduction);

  let tax = 0;
  for (const bracket of brackets) {
    if (taxable <= bracket.min) break;
    const amountInBracket = Math.min(taxable, bracket.max) - bracket.min;
    tax += amountInBracket * bracket.rate;
  }

  return Math.round(tax);
}

/**
 * Simplified 2025 NJ state income tax brackets.
 */
function calculateNJStateTax(annualIncome: number): number {
  const brackets = [
    { min: 0, max: 20000, rate: 0.014 },
    { min: 20000, max: 35000, rate: 0.0175 },
    { min: 35000, max: 40000, rate: 0.035 },
    { min: 40000, max: 75000, rate: 0.05525 },
    { min: 75000, max: 500000, rate: 0.0637 },
    { min: 500000, max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ];

  let tax = 0;
  for (const bracket of brackets) {
    if (annualIncome <= bracket.min) break;
    const amountInBracket = Math.min(annualIncome, bracket.max) - bracket.min;
    tax += amountInBracket * bracket.rate;
  }

  return Math.round(tax);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert Prisma Decimal to number safely.
 */
export function decimalToNumber(val: Decimal | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return Number(val);
}
