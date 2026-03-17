import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { calculatePayslip, decimalToNumber } from '@/lib/payroll/calculator';
import type { EmployeePayrollInput } from '@/lib/payroll/calculator';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2099),
  region: z.enum(['US', 'INDIA']),
  notes: z.string().max(1000).optional().nullable(),
});

const updateRunSchema = z.object({
  runId: z.string().cuid('Invalid payroll run ID'),
  action: z.enum(['PROCESS', 'APPROVE', 'REJECT', 'PAY']),
});

// ─── State Machine ──────────────────────────────────────────────────────────

/**
 * Valid status transitions for a payroll run.
 * Key = current status, value = map of action -> next status.
 */
const STATUS_TRANSITIONS: Record<string, Record<string, string>> = {
  DRAFT: {
    PROCESS: 'PENDING_APPROVAL',
  },
  PENDING_APPROVAL: {
    APPROVE: 'APPROVED',
    REJECT: 'DRAFT',
  },
  APPROVED: {
    PAY: 'PAID',
  },
};

/**
 * Permission required for each action.
 */
const ACTION_PERMISSIONS: Record<string, string> = {
  PROCESS: 'payroll:run',
  APPROVE: 'payroll:approve',
  REJECT: 'payroll:approve',
  PAY: 'payroll:run',
};

// ─── GET /api/payroll/run ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'payroll:view_all');

    const companyId = (session!.user as any).companyId as string;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // ── Single run detail ────────────────────────────────────────────────
    if (id) {
      const run = await db.payrollRun.findFirst({
        where: { id, companyId },
        include: {
          payslips: {
            include: {
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeId: true,
                  department: { select: { name: true } },
                },
              },
            },
            orderBy: { employee: { lastName: 'asc' } },
          },
        },
      });

      if (!run) {
        return NextResponse.json(
          { error: 'Payroll run not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: run });
    }

    // ── Paginated list ───────────────────────────────────────────────────
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      Math.max(1, parseInt(searchParams.get('pageSize') || '20')),
      100,
    );
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const region = searchParams.get('region');
    const status = searchParams.get('status');

    // Build period filter from month+year if both provided
    let periodFilter: string | undefined;
    if (month && year) {
      periodFilter = `${year}-${String(parseInt(month)).padStart(2, '0')}`;
    }

    const where: Record<string, unknown> = {
      companyId,
      ...(periodFilter && { period: periodFilter }),
      ...(region && { region }),
      ...(status && { status }),
    };

    const [runs, total] = await Promise.all([
      db.payrollRun.findMany({
        where,
        include: {
          _count: { select: { payslips: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.payrollRun.count({ where }),
    ]);

    return NextResponse.json({
      data: runs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── POST /api/payroll/run ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'payroll:run');

    const body = await req.json();
    const validated = createRunSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;
    const period = `${validated.year}-${String(validated.month).padStart(2, '0')}`;
    const { region } = validated;

    // ── Guard: no duplicate run for same period+region ────────────────
    const existingRun = await db.payrollRun.findFirst({
      where: {
        companyId,
        period,
        region,
        status: { in: ['DRAFT', 'PROCESSING'] },
      },
    });

    if (existingRun) {
      return NextResponse.json(
        {
          error: `A payroll run for ${period} (${region}) already exists in ${existingRun.status} status`,
          existingRunId: existingRun.id,
        },
        { status: 409 },
      );
    }

    // ── Fetch active employees with latest salary ────────────────────
    const employees = await db.employee.findMany({
      where: {
        companyId,
        region,
        status: 'ACTIVE',
      },
      include: {
        salaryHistory: {
          orderBy: { effectiveFrom: 'desc' as const },
          take: 1,
        },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: `No active employees found for region ${region}` },
        { status: 422 },
      );
    }

    // Filter out employees without salary history
    const employeesWithSalary = employees.filter(
      (emp) => emp.salaryHistory.length > 0,
    );

    if (employeesWithSalary.length === 0) {
      return NextResponse.json(
        { error: 'No employees have salary history configured' },
        { status: 422 },
      );
    }

    // ── Calculate payslips for each employee ─────────────────────────
    const currency = region === 'INDIA' ? 'INR' : 'USD';
    const payslipBreakdowns = employeesWithSalary.map((emp) => {
      const latestSalary = emp.salaryHistory[0];
      const input: EmployeePayrollInput = {
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        region: emp.region as 'US' | 'INDIA',
        annualSalary: decimalToNumber(latestSalary.baseSalary),
        workLocation: emp.workLocation,
      };

      return calculatePayslip(input, validated.month, validated.year);
    });

    // ── Sum totals ───────────────────────────────────────────────────
    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;

    for (const ps of payslipBreakdowns) {
      totalGross += ps.grossPay;
      totalNet += ps.netPay;
      // Total tax includes federal/TDS + state tax + PF + ESI
      totalTax +=
        ps.taxDeducted +
        (ps.stateTax ?? 0) +
        (ps.pf ?? 0) +
        (ps.esi ?? 0);
    }

    // ── Create run + payslips in a single transaction ────────────────
    const payrollRun = await db.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId,
          period,
          region,
          status: 'DRAFT',
          currency,
          totalGross,
          totalNet,
          totalTax,
          notes: validated.notes ?? null,
        },
      });

      // Batch-create all payslips
      await tx.payslip.createMany({
        data: payslipBreakdowns.map((ps) => ({
          payrollRunId: run.id,
          employeeId: ps.employeeId,
          period: ps.period,
          currency: ps.currency,
          basicSalary: ps.basicSalary,
          hra: ps.hra,
          allowances: ps.allowances,
          deductions: ps.deductions,
          grossPay: ps.grossPay,
          taxDeducted: ps.taxDeducted,
          stateTax: ps.stateTax,
          pf: ps.pf,
          esi: ps.esi,
          netPay: ps.netPay,
          leaveDays: ps.leaveDays,
          overtimePay: ps.overtimePay > 0 ? ps.overtimePay : null,
          bonuses: ps.bonuses > 0 ? ps.bonuses : null,
        })),
      });

      // Audit log
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'CREATE',
          resource: 'PayrollRun',
          resourceId: run.id,
          after: {
            period,
            region,
            currency,
            employeeCount: payslipBreakdowns.length,
            totalGross,
            totalNet,
            totalTax,
          },
        }),
      });

      return run;
    });

    // ── Return summary ───────────────────────────────────────────────
    return NextResponse.json(
      {
        data: {
          ...payrollRun,
          summary: {
            employeeCount: payslipBreakdowns.length,
            totalGross,
            totalNet,
            totalTax,
            currency,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── PATCH /api/payroll/run ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    const body = await req.json();
    const validated = updateRunSchema.parse(body);
    const { runId, action } = validated;

    // ── Permission check based on action ─────────────────────────────
    const requiredPermission = ACTION_PERMISSIONS[action];
    await checkPermission(session, requiredPermission as any);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    // ── Fetch current run ────────────────────────────────────────────
    const currentRun = await db.payrollRun.findFirst({
      where: { id: runId, companyId },
    });

    if (!currentRun) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 },
      );
    }

    // ── Validate state transition ────────────────────────────────────
    const allowedTransitions = STATUS_TRANSITIONS[currentRun.status];
    if (!allowedTransitions || !allowedTransitions[action]) {
      return NextResponse.json(
        {
          error: `Cannot perform '${action}' on a payroll run in '${currentRun.status}' status`,
          currentStatus: currentRun.status,
          allowedActions: allowedTransitions
            ? Object.keys(allowedTransitions)
            : [],
        },
        { status: 409 },
      );
    }

    const nextStatus = allowedTransitions[action];
    const now = new Date();

    // ── Build update data based on action ────────────────────────────
    const updateData: Record<string, unknown> = {
      status: nextStatus,
    };

    if (action === 'APPROVE') {
      updateData.approvedById = actorId;
    }

    if (action === 'PAY') {
      updateData.processedAt = now;
    }

    // ── Execute transition in a transaction ──────────────────────────
    const updatedRun = await db.$transaction(async (tx) => {
      const run = await tx.payrollRun.update({
        where: { id: runId },
        data: updateData,
      });

      // When PAY: mark all payslips as paid
      if (action === 'PAY') {
        await tx.payslip.updateMany({
          where: { payrollRunId: runId },
          data: { paidAt: now },
        });
      }

      // Audit log for the transition
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'UPDATE',
          resource: 'PayrollRun',
          resourceId: runId,
          before: {
            status: currentRun.status,
          },
          after: {
            status: nextStatus,
            action,
            ...(action === 'APPROVE' && { approvedById: actorId }),
            ...(action === 'PAY' && { processedAt: now.toISOString() }),
          },
        }),
      });

      return run;
    });

    return NextResponse.json({
      data: updatedRun,
      transition: {
        from: currentRun.status,
        to: nextStatus,
        action,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
