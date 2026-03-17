import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { updateEmployeeSchema } from '@/lib/validations/employee';
import {
  encryptFields,
  SENSITIVE_EMPLOYEE_FIELDS,
} from '@/lib/encryption';
import { createAuditEntry, buildChanges } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const employee = await db.employee.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        designation: true,
        reportingTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Verify same company
    if (employee.companyId !== (session!.user as any).companyId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Fields an EMPLOYEE role is allowed to update on their own record.
// Everything else (department, salary, status, PII, etc.) requires HR+ role.
// ---------------------------------------------------------------------------
const SELF_EDITABLE_FIELDS = new Set([
  'phone',
  'personalEmail',
  'emergencyContact',
  'profilePhotoUrl',
  'preferredName',
  'workLocation',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    // ── Auth: accept employee:update (HR+) OR employee:update_own (MANAGER/EMPLOYEE)
    const userRole = (session?.user as any)?.role as string | undefined;
    const canUpdateAny = userRole ? hasPermission(userRole, 'employee:update') : false;
    const canUpdateOwn = userRole ? hasPermission(userRole, 'employee:update_own') : false;

    if (!canUpdateAny && !canUpdateOwn) {
      await checkPermission(session, 'employee:update'); // will throw 401/403
    }

    // ── Validate request body
    const body = await req.json();
    const validatedData = updateEmployeeSchema.parse(body);

    const sessionUser = session!.user as any;
    const companyId: string = sessionUser.companyId;
    const sessionEmployeeId: string = sessionUser.employeeId;

    // ── Fetch existing employee (verify company boundary)
    const existingEmployee = await db.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee || existingEmployee.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // ── Ownership / scope checks for non-HR roles
    if (!canUpdateAny) {
      if (userRole === 'MANAGER') {
        // Managers may only update their direct reports
        if (existingEmployee.reportingToId !== sessionEmployeeId) {
          return NextResponse.json(
            { error: 'You can only update your direct reports' },
            { status: 403 }
          );
        }
      } else if (userRole === 'EMPLOYEE') {
        // Employees may only update their own record
        if (id !== sessionEmployeeId) {
          return NextResponse.json(
            { error: 'You can only update your own record' },
            { status: 403 }
          );
        }
        // Restrict to non-sensitive self-editable fields
        const disallowedKeys = Object.keys(validatedData).filter(
          (key) => !SELF_EDITABLE_FIELDS.has(key)
        );
        if (disallowedKeys.length > 0) {
          return NextResponse.json(
            {
              error: 'You do not have permission to update these fields',
              fields: disallowedKeys,
            },
            { status: 403 }
          );
        }
      }
    }

    // ── Detect salary change for SalaryHistory creation
    const hasSalaryChange = 'baseSalary' in validatedData && validatedData.baseSalary !== undefined;

    // ── Encrypt sensitive fields if they are being updated
    const sensitiveKeysInPayload = SENSITIVE_EMPLOYEE_FIELDS.filter(
      (field) => field in validatedData
    );
    const dataToWrite =
      sensitiveKeysInPayload.length > 0
        ? encryptFields(validatedData as Record<string, unknown>, sensitiveKeysInPayload)
        : validatedData;

    // ── Execute all writes in a single transaction
    const updatedEmployee = await db.$transaction(async (tx) => {
      // (a) Update the employee record
      const updated = await tx.employee.update({
        where: { id },
        data: dataToWrite,
        include: {
          department: true,
          designation: true,
          reportingTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
            },
          },
        },
      });

      // (b) Create SalaryHistory entry when salary changes
      if (hasSalaryChange) {
        await tx.salaryHistory.create({
          data: {
            employeeId: id,
            baseSalary: (validatedData as any).baseSalary,
            bonus: (validatedData as any).bonus ?? undefined,
            equity: (validatedData as any).equity ?? undefined,
            currency: (validatedData as any).currency ?? (existingEmployee.region === 'INDIA' ? 'INR' : 'USD'),
            effectiveFrom: new Date(),
            reason: (validatedData as any).salaryChangeReason ?? 'Salary updated',
            approvedById: sessionEmployeeId,
          },
        });
      }

      // (c) Audit log with field-level diff (sensitive values redacted)
      const changes = buildChanges(
        existingEmployee as unknown as Record<string, unknown>,
        dataToWrite as Record<string, unknown>,
        ['ssn', 'aadhaarNumber', 'panNumber', 'bankDetails']
      );

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: sessionEmployeeId,
          action: 'UPDATE',
          resource: 'Employee',
          resourceId: id,
          before: changes,
          after: null,
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return updated;
    });

    // ── Strip sensitive fields from the response
    const { ssn, aadhaarNumber, panNumber, bankDetails, ...safeEmployee } =
      updatedEmployee as any;

    return NextResponse.json(safeEmployee);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/employees/[id] — Soft-delete (terminate) an employee
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'employee:delete');

    const sessionUser = session!.user as any;
    const companyId: string = sessionUser.companyId;
    const sessionEmployeeId: string = sessionUser.employeeId;

    // ── Fetch employee and verify company boundary
    const employee = await db.employee.findUnique({
      where: { id },
    });

    if (!employee || employee.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Prevent terminating an already terminated / offboarded employee
    if (employee.status === 'TERMINATED' || employee.status === 'OFFBOARDED') {
      return NextResponse.json(
        { error: 'Employee is already terminated or offboarded' },
        { status: 409 }
      );
    }

    const today = new Date();

    await db.$transaction(async (tx) => {
      // (a) Soft-delete: set status to TERMINATED and record last working day
      await tx.employee.update({
        where: { id },
        data: {
          status: 'TERMINATED',
          lastWorkingDay: today,
        },
      });

      // (b) Deactivate linked User account if one exists
      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: {
            lockedUntil: new Date('9999-12-31T23:59:59.999Z'),
          },
        });
      }

      // (c) Audit log
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: sessionEmployeeId,
          action: 'DELETE',
          resource: 'Employee',
          resourceId: id,
          before: {
            status: employee.status,
            lastWorkingDay: employee.lastWorkingDay,
          },
          after: {
            status: 'TERMINATED',
            lastWorkingDay: today.toISOString(),
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });
    });

    return NextResponse.json({ message: 'Employee terminated successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
