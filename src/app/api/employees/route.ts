import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createEmployeeSchema } from '@/lib/validations/employee';
import { encryptFields, SENSITIVE_EMPLOYEE_FIELDS } from '@/lib/encryption';
import { createAuditEntry } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/email/sender';
import { addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: any = {
      companyId: (session!.user as any).companyId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(department && { departmentId: department }),
      ...(status && { status }),
    };

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: { department: true, designation: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.employee.count({ where }),
    ]);

    return NextResponse.json({
      data: employees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:create');

    const body = await req.json();
    const validated = createEmployeeSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorEmployeeId = (session!.user as any).employeeId as string;

    // Generate temporary password
    const tempPassword = `Welcome@${Date.now().toString(36)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Generate next employee ID (format: GL-XXX)
    const lastEmployee = await db.employee.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { employeeId: true },
    });

    let nextNum = 1;
    if (lastEmployee?.employeeId) {
      const match = lastEmployee.employeeId.match(/GL-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const employeeId = `GL-${String(nextNum).padStart(3, '0')}`;

    // Encrypt sensitive fields if present in the body
    const sensitiveData: Record<string, unknown> = {};
    for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
      if (body[field] && typeof body[field] === 'string') {
        sensitiveData[field] = body[field];
      }
    }
    const encryptedSensitive = Object.keys(sensitiveData).length > 0
      ? encryptFields(sensitiveData, Object.keys(sensitiveData) as (keyof typeof sensitiveData)[])
      : {};

    try {
      const employee = await db.$transaction(async (tx) => {
        // (a) Create User account
        const user = await tx.user.create({
          data: {
            email: validated.email,
            name: `${validated.firstName} ${validated.lastName}`,
            role: 'EMPLOYEE',
            passwordHash,
          },
        });

        // (b) + (c) Create Employee with validated fields, encrypted PII, and company link
        const newEmployee = await tx.employee.create({
          data: {
            companyId,
            userId: user.id,
            employeeId,
            firstName: validated.firstName,
            lastName: validated.lastName,
            email: validated.email,
            personalEmail: validated.personalEmail ?? null,
            phone: validated.phone ?? null,
            dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
            gender: validated.gender ?? null,
            nationality: validated.nationality ?? null,
            departmentId: validated.departmentId ?? null,
            designationId: validated.designationId ?? null,
            reportingToId: validated.reportingToId ?? null,
            region: validated.region,
            employmentType: validated.employmentType,
            joinedAt: new Date(validated.joinedAt),
            probationEndsAt: validated.probationEndsAt ? new Date(validated.probationEndsAt) : null,
            workLocation: validated.workLocation ?? null,
            // Encrypted sensitive fields
            ...encryptedSensitive,
          },
          include: {
            department: true,
            designation: true,
          },
        });

        // (d) + (e) Create leave balances from active LeaveTypeConfig for this region
        const leaveConfigs = await tx.leaveTypeConfig.findMany({
          where: {
            companyId,
            isActive: true,
            OR: [
              { region: validated.region },
              { region: null },
            ],
          },
        });

        if (leaveConfigs.length > 0) {
          await tx.leaveBalance.createMany({
            data: leaveConfigs.map((config) => ({
              employeeId: newEmployee.id,
              leaveTypeId: config.id,
              year: 2026,
              entitled: config.daysAllowed,
              used: 0,
              pending: 0,
              carried: 0,
            })),
          });
        }

        // (f) + (g) Create onboarding tasks from matching checklist
        const checklist = await tx.onboardingChecklist.findFirst({
          where: {
            companyId,
            region: validated.region,
            employmentType: validated.employmentType,
          },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
            },
          },
        });

        if (checklist && checklist.tasks.length > 0) {
          const joinDate = new Date(validated.joinedAt);
          await tx.onboardingTask.createMany({
            data: checklist.tasks.map((template) => ({
              employeeId: newEmployee.id,
              templateId: template.id,
              title: template.title,
              description: template.description,
              dueDate: addDays(joinDate, template.dueOffsetDays),
              assignedTo: template.assigneeTo,
              isRequired: template.isRequired,
            })),
          });
        }

        // (h) Create audit log entry
        await tx.auditLog.create({
          data: createAuditEntry({
            companyId,
            actorId: actorEmployeeId,
            action: 'CREATE',
            resource: 'Employee',
            resourceId: newEmployee.id,
            after: {
              email: validated.email,
              firstName: validated.firstName,
              lastName: validated.lastName,
              region: validated.region,
              employmentType: validated.employmentType,
            },
          }),
        });

        return newEmployee;
      });

      // (5) Send welcome email (fire-and-forget)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hr.gliscolab.com';
      sendEmail({
        to: validated.email,
        subject: 'Welcome to Glisco Lab – Your Account is Ready',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">GliscoHR</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="margin-top: 0;">Welcome to Glisco Lab, ${validated.firstName}! 🎉</h2>
              <p>Your employee account has been created. Use the credentials below to log in and get started.</p>
              <div style="background: #f3f4f6; padding: 16px 20px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 4px 0;"><strong>Email:</strong> ${validated.email}</p>
                <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>
              <p style="color: #dc2626; font-size: 14px;">⚠️ Please change your password after your first login.</p>
              <a href="${appUrl}/login" style="display: inline-block; background: #4B9EFF; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">Log In to GliscoHR</a>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
              <p style="color: #6b7280; font-size: 13px; margin-bottom: 0;">If you didn't expect this email, please contact your HR administrator.</p>
            </div>
          </div>
        `,
      }).catch((err) => console.error('[welcome-email] Failed to send:', err));

      // (6) Return created employee without sensitive fields
      const { ssn, aadhaarNumber, panNumber, ...safeEmployee } = employee as any;

      return NextResponse.json({ data: safeEmployee }, { status: 201 });
    } catch (txError: any) {
      // Handle duplicate email (Prisma unique constraint violation)
      if (txError?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }
      throw txError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
