import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { withAudit } from '@/lib/audit';
import { createJobSchema } from '@/lib/validations/recruitment';
import { type JobStatus, type Region } from '@prisma/client';

// ---------------------------------------------------------------------------
// GET /api/recruitment/jobs
// ---------------------------------------------------------------------------
// Lists jobs for the authenticated user's company with pagination, filtering
// by status, departmentId, and region.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:view');

    const companyId = (session!.user as any).companyId as string;
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as JobStatus | null;
    const departmentId = searchParams.get('departmentId') || undefined;
    const region = searchParams.get('region') as Region | null;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

    const where = {
      companyId,
      ...(status && { status }),
      ...(departmentId && { departmentId }),
      ...(region && { region }),
    };

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        include: {
          designation: { select: { title: true } },
          department: { select: { name: true } },
          _count: { select: { candidates: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      data: jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/recruitment/jobs
// ---------------------------------------------------------------------------
// Creates a new job posting. companyId is always taken from the session,
// never from the client payload.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage');

    const companyId = (session!.user as any).companyId as string;
    const employeeId = (session!.user as any).employeeId as string | undefined;
    const body = await req.json();

    // Validate — override companyId with session value so clients cannot spoof it
    const validated = createJobSchema.parse({
      ...body,
      companyId,
    });

    // withAudit passes params by reference — the audit log is written AFTER
    // the operation callback returns, so mutating auditParams.resourceId
    // inside the callback ensures the audit entry records the real job id.
    const auditParams = {
      companyId,
      actorId: employeeId ?? null,
      action: 'CREATE' as const,
      resource: 'Job',
      resourceId: '', // mutated inside callback once id is known
      after: validated as unknown as Record<string, unknown>,
    };

    const job = await withAudit(auditParams, async (tx) => {
      const created = await tx.job.create({
        data: {
          companyId: validated.companyId,
          title: validated.title,
          description: validated.description,
          requirements: validated.requirements ?? null,
          designationId: validated.designationId ?? null,
          departmentId: validated.departmentId ?? null,
          employmentType: validated.employmentType,
          region: validated.region,
          salaryMin: validated.salaryMin ?? null,
          salaryMax: validated.salaryMax ?? null,
          currency: validated.currency,
          openings: validated.openings,
          closesAt: validated.closesAt ? new Date(validated.closesAt) : null,
          hiringManagerId: validated.hiringManagerId ?? null,
          status: 'DRAFT',
        },
        include: {
          designation: { select: { title: true } },
          department: { select: { name: true } },
        },
      });

      auditParams.resourceId = created.id;
      return created;
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
