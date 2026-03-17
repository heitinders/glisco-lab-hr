import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportResult {
  data: Record<string, unknown>[];
  columns: ReportColumn[];
  summary: Record<string, unknown>;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  region?: string;
  /** When set, scope all queries to employees reporting to this manager */
  managerId?: string;
}

export const VALID_REPORT_TYPES = [
  'headcount',
  'leave',
  'payroll',
  'turnover',
  'compliance',
] as const;

export type ReportType = (typeof VALID_REPORT_TYPES)[number];

// ─── Main Generator ─────────────────────────────────────────────────────────

export async function generateReport(
  type: string,
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  switch (type) {
    case 'headcount':
      return generateHeadcountReport(companyId, filters);
    case 'leave':
      return generateLeaveReport(companyId, filters);
    case 'payroll':
      return generatePayrollReport(companyId, filters);
    case 'turnover':
      return generateTurnoverReport(companyId, filters);
    case 'compliance':
      return generateComplianceReport(companyId, filters);
    default:
      throw new Error(`Invalid report type: ${type}`);
  }
}

// ─── Headcount Report ───────────────────────────────────────────────────────

async function generateHeadcountReport(
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const where: Prisma.EmployeeWhereInput = {
    companyId,
    ...(filters.department && { departmentId: filters.department }),
    ...(filters.region && { region: filters.region as any }),
    ...(filters.managerId && { reportingToId: filters.managerId }),
  };

  const employees = await db.employee.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      status: true,
      region: true,
      employmentType: true,
      joinedAt: true,
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { lastName: 'asc' }],
  });

  const data = employees.map((emp) => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name ?? 'Unassigned',
    designation: emp.designation?.title ?? 'N/A',
    region: emp.region,
    status: emp.status,
    employmentType: emp.employmentType,
    joinedAt: emp.joinedAt.toISOString().split('T')[0],
  }));

  const totalActive = employees.filter((e) => e.status === 'ACTIVE').length;
  const byRegion: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const emp of employees) {
    byRegion[emp.region] = (byRegion[emp.region] || 0) + 1;
    const dept = emp.department?.name ?? 'Unassigned';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    byStatus[emp.status] = (byStatus[emp.status] || 0) + 1;
  }

  return {
    data,
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'region', label: 'Region' },
      { key: 'status', label: 'Status' },
      { key: 'employmentType', label: 'Employment Type' },
      { key: 'joinedAt', label: 'Joined' },
    ],
    summary: {
      totalEmployees: employees.length,
      totalActive,
      byRegion,
      byDepartment,
      byStatus,
    },
  };
}

// ─── Leave Report ───────────────────────────────────────────────────────────

async function generateLeaveReport(
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

  const where: Prisma.LeaveRequestWhereInput = {
    employee: {
      companyId,
      ...(filters.department && { departmentId: filters.department }),
      ...(filters.region && { region: filters.region as any }),
      ...(filters.managerId && { reportingToId: filters.managerId }),
    },
    ...(dateFrom || dateTo
      ? {
          startDate: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : {}),
  };

  const requests = await db.leaveRequest.findMany({
    where,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      createdAt: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeId: true,
          department: { select: { name: true } },
          region: true,
        },
      },
      leaveType: { select: { name: true, leaveType: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const data = requests.map((req) => ({
    employeeId: req.employee.employeeId,
    employeeName: `${req.employee.firstName} ${req.employee.lastName}`,
    department: req.employee.department?.name ?? 'Unassigned',
    leaveType: req.leaveType.name,
    startDate: req.startDate.toISOString().split('T')[0],
    endDate: req.endDate.toISOString().split('T')[0],
    totalDays: req.totalDays,
    status: req.status,
  }));

  const totalRequests = requests.length;
  const approved = requests.filter((r) => r.status === 'APPROVED').length;
  const rejected = requests.filter((r) => r.status === 'REJECTED').length;
  const pending = requests.filter((r) => r.status === 'PENDING').length;
  const totalDaysUsed = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((sum, r) => sum + r.totalDays, 0);

  const byType: Record<string, number> = {};
  for (const req of requests) {
    const typeName = req.leaveType.name;
    byType[typeName] = (byType[typeName] || 0) + 1;
  }

  return {
    data,
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'leaveType', label: 'Leave Type' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'totalDays', label: 'Days' },
      { key: 'status', label: 'Status' },
    ],
    summary: {
      totalRequests,
      approved,
      rejected,
      pending,
      totalDaysUsed,
      byType,
    },
  };
}

// ─── Payroll Report ─────────────────────────────────────────────────────────

async function generatePayrollReport(
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const where: Prisma.PayrollRunWhereInput = {
    companyId,
    ...(filters.region && { region: filters.region as any }),
  };

  // Filter by period (YYYY-MM format) based on date range
  if (filters.dateFrom || filters.dateTo) {
    const periodFilters: string[] = [];

    if (filters.dateFrom && filters.dateTo) {
      const from = new Date(filters.dateFrom);
      const to = new Date(filters.dateTo);
      const current = new Date(from.getFullYear(), from.getMonth(), 1);

      while (current <= to) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        periodFilters.push(`${year}-${month}`);
        current.setMonth(current.getMonth() + 1);
      }

      if (periodFilters.length > 0) {
        where.period = { in: periodFilters };
      }
    } else if (filters.dateFrom) {
      where.period = { gte: filters.dateFrom.slice(0, 7) };
    } else if (filters.dateTo) {
      where.period = { lte: filters.dateTo.slice(0, 7) };
    }
  }

  const runs = await db.payrollRun.findMany({
    where,
    select: {
      id: true,
      period: true,
      region: true,
      status: true,
      currency: true,
      totalGross: true,
      totalNet: true,
      totalTax: true,
      processedAt: true,
      _count: { select: { payslips: true } },
    },
    orderBy: { period: 'desc' },
  });

  const data = runs.map((run) => ({
    period: run.period,
    region: run.region,
    status: run.status,
    currency: run.currency,
    totalGross: Number(run.totalGross).toLocaleString('en-US', {
      minimumFractionDigits: 2,
    }),
    totalNet: Number(run.totalNet).toLocaleString('en-US', {
      minimumFractionDigits: 2,
    }),
    totalTax: Number(run.totalTax).toLocaleString('en-US', {
      minimumFractionDigits: 2,
    }),
    employeeCount: run._count.payslips,
    processedAt: run.processedAt
      ? run.processedAt.toISOString().split('T')[0]
      : 'Not processed',
  }));

  const totalGross = runs.reduce((sum, r) => sum + Number(r.totalGross), 0);
  const totalNet = runs.reduce((sum, r) => sum + Number(r.totalNet), 0);
  const totalTax = runs.reduce((sum, r) => sum + Number(r.totalTax), 0);

  return {
    data,
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'region', label: 'Region' },
      { key: 'status', label: 'Status' },
      { key: 'currency', label: 'Currency' },
      { key: 'totalGross', label: 'Gross Pay' },
      { key: 'totalNet', label: 'Net Pay' },
      { key: 'totalTax', label: 'Tax' },
      { key: 'employeeCount', label: 'Employees' },
      { key: 'processedAt', label: 'Processed' },
    ],
    summary: {
      totalRuns: runs.length,
      totalGross: totalGross.toLocaleString('en-US', {
        minimumFractionDigits: 2,
      }),
      totalNet: totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      totalTax: totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
  };
}

// ─── Turnover Report ────────────────────────────────────────────────────────

async function generateTurnoverReport(
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

  const baseWhere: Prisma.EmployeeWhereInput = {
    companyId,
    ...(filters.department && { departmentId: filters.department }),
    ...(filters.region && { region: filters.region as any }),
    ...(filters.managerId && { reportingToId: filters.managerId }),
  };

  // Employees who joined in the period
  const joinedWhere: Prisma.EmployeeWhereInput = {
    ...baseWhere,
    ...(dateFrom || dateTo
      ? {
          joinedAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : {}),
  };

  // Employees who left in the period (have lastWorkingDay set)
  const exitedWhere: Prisma.EmployeeWhereInput = {
    ...baseWhere,
    lastWorkingDay: {
      not: null,
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo && { lte: dateTo }),
    },
  };

  const [joined, exited, totalActive] = await Promise.all([
    db.employee.findMany({
      where: joinedWhere,
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        joinedAt: true,
        department: { select: { name: true } },
        region: true,
        designationId: true,
        designation: { select: { title: true } },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    db.employee.findMany({
      where: exitedWhere,
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        lastWorkingDay: true,
        terminationReason: true,
        department: { select: { name: true } },
        region: true,
        designation: { select: { title: true } },
      },
      orderBy: { lastWorkingDay: 'desc' },
    }),
    db.employee.count({
      where: { companyId, status: 'ACTIVE' },
    }),
  ]);

  const data: Record<string, unknown>[] = [];

  for (const emp of joined) {
    data.push({
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name ?? 'Unassigned',
      designation: emp.designation?.title ?? 'N/A',
      region: emp.region,
      event: 'JOINED',
      date: emp.joinedAt.toISOString().split('T')[0],
      reason: '-',
    });
  }

  for (const emp of exited) {
    data.push({
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name ?? 'Unassigned',
      designation: emp.designation?.title ?? 'N/A',
      region: emp.region,
      event: 'EXITED',
      date: emp.lastWorkingDay!.toISOString().split('T')[0],
      reason: emp.terminationReason ?? 'N/A',
    });
  }

  // Sort combined data by date descending
  data.sort((a, b) => {
    const dateA = a.date as string;
    const dateB = b.date as string;
    return dateB.localeCompare(dateA);
  });

  const joinCount = joined.length;
  const exitCount = exited.length;
  // Turnover rate = exits / average headcount * 100
  const avgHeadcount = totalActive > 0 ? totalActive : 1;
  const turnoverRate =
    avgHeadcount > 0
      ? Number(((exitCount / avgHeadcount) * 100).toFixed(1))
      : 0;

  return {
    data,
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'region', label: 'Region' },
      { key: 'event', label: 'Event' },
      { key: 'date', label: 'Date' },
      { key: 'reason', label: 'Reason' },
    ],
    summary: {
      joinCount,
      exitCount,
      turnoverRate: `${turnoverRate}%`,
      currentHeadcount: totalActive,
    },
  };
}

// ─── Compliance Report ──────────────────────────────────────────────────────

async function generateComplianceReport(
  companyId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const employeeWhere: Prisma.EmployeeWhereInput = {
    companyId,
    status: 'ACTIVE',
    ...(filters.department && { departmentId: filters.department }),
    ...(filters.region && { region: filters.region as any }),
    ...(filters.managerId && { reportingToId: filters.managerId }),
  };

  // Find documents expiring within 30 days
  const expiringDocuments = await db.employeeDocument.findMany({
    where: {
      employee: employeeWhere,
      expiresAt: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
    },
    select: {
      id: true,
      name: true,
      category: true,
      expiresAt: true,
      employee: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          region: true,
        },
      },
    },
    orderBy: { expiresAt: 'asc' },
  });

  // Find already-expired documents
  const expiredDocuments = await db.employeeDocument.findMany({
    where: {
      employee: employeeWhere,
      expiresAt: {
        lt: now,
      },
    },
    select: {
      id: true,
      name: true,
      category: true,
      expiresAt: true,
      employee: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          region: true,
        },
      },
    },
    orderBy: { expiresAt: 'asc' },
  });

  // Find employees with missing critical data
  const employeesWithMissingData = await db.employee.findMany({
    where: {
      ...employeeWhere,
      OR: [
        { dateOfBirth: null },
        { gender: null },
        { departmentId: null },
        { designationId: null },
        { phone: null },
      ],
    },
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      departmentId: true,
      designationId: true,
      department: { select: { name: true } },
      region: true,
    },
  });

  // Find employees past probation end without confirmation
  const unconfirmedPastProbation = await db.employee.findMany({
    where: {
      ...employeeWhere,
      probationEndsAt: { lt: now },
      confirmedAt: null,
    },
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      probationEndsAt: true,
      department: { select: { name: true } },
      region: true,
    },
  });

  const data: Record<string, unknown>[] = [];

  for (const doc of expiredDocuments) {
    data.push({
      employeeId: doc.employee.employeeId,
      employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
      department: doc.employee.department?.name ?? 'Unassigned',
      region: doc.employee.region,
      issueType: 'Expired Document',
      detail: `${doc.name} (${doc.category})`,
      date: doc.expiresAt!.toISOString().split('T')[0],
      severity: 'HIGH',
    });
  }

  for (const doc of expiringDocuments) {
    data.push({
      employeeId: doc.employee.employeeId,
      employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
      department: doc.employee.department?.name ?? 'Unassigned',
      region: doc.employee.region,
      issueType: 'Expiring Document',
      detail: `${doc.name} (${doc.category})`,
      date: doc.expiresAt!.toISOString().split('T')[0],
      severity: 'MEDIUM',
    });
  }

  for (const emp of employeesWithMissingData) {
    const missing: string[] = [];
    if (!emp.dateOfBirth) missing.push('Date of Birth');
    if (!emp.gender) missing.push('Gender');
    if (!emp.departmentId) missing.push('Department');
    if (!emp.designationId) missing.push('Designation');
    if (!emp.phone) missing.push('Phone');

    data.push({
      employeeId: emp.employeeId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name ?? 'Unassigned',
      region: emp.region,
      issueType: 'Missing Data',
      detail: missing.join(', '),
      date: '-',
      severity: 'LOW',
    });
  }

  for (const emp of unconfirmedPastProbation) {
    data.push({
      employeeId: emp.employeeId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name ?? 'Unassigned',
      region: emp.region,
      issueType: 'Pending Confirmation',
      detail: `Probation ended ${emp.probationEndsAt!.toISOString().split('T')[0]}`,
      date: emp.probationEndsAt!.toISOString().split('T')[0],
      severity: 'HIGH',
    });
  }

  return {
    data,
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'region', label: 'Region' },
      { key: 'issueType', label: 'Issue Type' },
      { key: 'detail', label: 'Detail' },
      { key: 'date', label: 'Date' },
      { key: 'severity', label: 'Severity' },
    ],
    summary: {
      expiredDocuments: expiredDocuments.length,
      expiringDocuments: expiringDocuments.length,
      missingData: employeesWithMissingData.length,
      pendingConfirmation: unconfirmedPastProbation.length,
      totalIssues: data.length,
    },
  };
}
