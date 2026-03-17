/**
 * Indian Provident Fund (PF) Compliance Module
 *
 * Implements calculations for EPF (Employee Provident Fund) under
 * the Employees' Provident Funds and Miscellaneous Provisions Act, 1952.
 *
 * Reference: https://www.epfindia.gov.in/
 */

interface PFCalculationInput {
  /** Monthly basic salary in INR */
  basicSalary: number;
  /** Monthly Dearness Allowance in INR */
  dearnessAllowance: number;
  /** Whether the employee's basic + DA exceeds the PF ceiling */
  isVoluntaryHigherContribution?: boolean;
  /** Employee's age (for pension fund calculation) */
  employeeAge?: number;
}

interface PFCalculationResult {
  /** Employee's PF contribution (12% of basic + DA) */
  employeeContribution: number;
  /** Employer's EPF contribution */
  employerEPF: number;
  /** Employer's EPS (Pension) contribution */
  employerEPS: number;
  /** Employer's EDLI contribution */
  employerEDLI: number;
  /** EPF admin charges */
  epfAdminCharges: number;
  /** EDLI admin charges */
  edliAdminCharges: number;
  /** Total employer cost (all contributions + charges) */
  totalEmployerCost: number;
  /** Total deduction from employee salary */
  totalEmployeeDeduction: number;
  /** PF wage ceiling used for calculation */
  pfWageCeiling: number;
}

/**
 * PF wage ceiling as per EPFO (currently Rs. 15,000)
 */
const PF_WAGE_CEILING = 15000;

/**
 * Rate constants as per EPFO rules (2024-25)
 */
const RATES = {
  EMPLOYEE_PF: 0.12, // 12% employee PF contribution
  EMPLOYER_EPF: 0.0367, // 3.67% to EPF
  EMPLOYER_EPS: 0.0833, // 8.33% to EPS (Pension)
  EMPLOYER_EDLI: 0.005, // 0.50% EDLI
  EPF_ADMIN: 0.005, // 0.50% admin charges (min Rs. 500)
  EDLI_ADMIN: 0.005, // 0.50% EDLI admin charges (min Rs. 200)
};

/**
 * Calculate PF (Provident Fund) contributions for an employee.
 *
 * EPF contribution structure:
 * - Employee: 12% of (Basic + DA) to EPF
 * - Employer: 3.67% to EPF + 8.33% to EPS (capped at PF ceiling for EPS)
 * - EDLI: 0.50% of (Basic + DA) capped at ceiling
 * - Admin charges: 0.50% EPF admin + 0.50% EDLI admin
 */
export function calculatePF(input: PFCalculationInput): PFCalculationResult {
  const {
    basicSalary,
    dearnessAllowance,
    isVoluntaryHigherContribution = false,
  } = input;

  const totalPFWage = basicSalary + dearnessAllowance;

  // For EPS, the wage is capped at PF_WAGE_CEILING
  const epsWage = Math.min(totalPFWage, PF_WAGE_CEILING);

  // For EPF, if employee opts for voluntary higher contribution,
  // the full wage is considered; otherwise capped at ceiling
  const epfWage = isVoluntaryHigherContribution
    ? totalPFWage
    : Math.min(totalPFWage, PF_WAGE_CEILING);

  // Employee contribution: 12% of PF wage
  const employeeContribution = Math.round(epfWage * RATES.EMPLOYEE_PF);

  // Employer EPS contribution: 8.33% of PF wage (capped at ceiling)
  const employerEPS = Math.round(epsWage * RATES.EMPLOYER_EPS);

  // Employer EPF contribution: 3.67% of PF wage
  // (Total employer 12% minus EPS 8.33% = 3.67%)
  const totalEmployerPF = Math.round(epfWage * RATES.EMPLOYEE_PF);
  const employerEPF = totalEmployerPF - employerEPS;

  // EDLI contribution: 0.50% (capped at ceiling)
  const edliWage = Math.min(totalPFWage, PF_WAGE_CEILING);
  const employerEDLI = Math.round(edliWage * RATES.EMPLOYER_EDLI);

  // Admin charges
  const epfAdminCharges = Math.max(500, Math.round(epfWage * RATES.EPF_ADMIN));
  const edliAdminCharges = Math.max(200, Math.round(edliWage * RATES.EDLI_ADMIN));

  const totalEmployerCost =
    employerEPF +
    employerEPS +
    employerEDLI +
    epfAdminCharges +
    edliAdminCharges;

  return {
    employeeContribution,
    employerEPF,
    employerEPS,
    employerEDLI,
    epfAdminCharges,
    edliAdminCharges,
    totalEmployerCost,
    totalEmployeeDeduction: employeeContribution,
    pfWageCeiling: PF_WAGE_CEILING,
  };
}

/**
 * Check if an employee is eligible for PF membership.
 *
 * PF is mandatory for establishments with 20+ employees.
 * Employees earning basic + DA <= Rs. 15,000 are mandatorily enrolled.
 * Employees earning above can opt out (existing members continue).
 */
export function isPFMandatory(
  basicPlusDA: number,
  isExistingMember: boolean
): boolean {
  if (isExistingMember) return true;
  return basicPlusDA <= PF_WAGE_CEILING;
}
