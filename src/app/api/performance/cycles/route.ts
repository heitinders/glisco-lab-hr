import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { createReviewCycleSchema } from '@/lib/validations/performance';
import { createAuditEntry } from '@/lib/audit';

// ---------------------------------------------------------------------------
// GET /api/performance/cycles
// ---------------------------------------------------------------------------
// HR+ (performance:view_all): all cycles for company with review counts and
//   optional status/year filters.
// Regular employees (performance:review_self): only cycles they participate in
//   as a review subject.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    // At minimum the caller must be an authenticated employee
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role as string;
    const companyId = (session.user as any).companyId as string;
    const employeeId = (session.user as any).employeeId as string;

    const isHrPlus = hasPermission(userRole, 'performance:view_all');

    // If the caller is not HR+ they must at least have review_self
    if (!isHrPlus) {
      await checkPermission(session, 'performance:review_self');
    }

    // ---- Query params ----
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status')?.toUpperCase(); // ACTIVE | COMPLETED
    const yearFilter = searchParams.get('year')
      ? parseInt(searchParams.get('year')!, 10)
      : undefined;

    // ---- Build where clause ----
    const where: any = { companyId };

    if (statusFilter === 'ACTIVE') {
      where.isActive = true;
    } else if (statusFilter === 'COMPLETED') {
      where.isActive = false;
    }

    if (yearFilter && !isNaN(yearFilter)) {
      where.startDate = {
        gte: new Date(`${yearFilter}-01-01T00:00:00Z`),
        lt: new Date(`${yearFilter + 1}-01-01T00:00:00Z`),
      };
    }

    if (isHrPlus) {
      // HR+ sees all cycles for the company with aggregate counts
      const cycles = await db.reviewCycle.findMany({
        where,
        include: {
          _count: { select: { reviews: true } },
        },
        orderBy: { startDate: 'desc' },
      });

      return NextResponse.json({ data: cycles });
    }

    // Regular employees: only cycles where they are a review subject
    where.reviews = {
      some: { subjectId: employeeId },
    };

    const cycles = await db.reviewCycle.findMany({
      where,
      include: {
        _count: { select: { reviews: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ data: cycles });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/performance/cycles
// ---------------------------------------------------------------------------
// Permission: performance:manage_cycles (HR_ADMIN+)
// Creates a new ReviewCycle inside a transaction with an AuditLog entry.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'performance:manage_cycles');

    const body = await req.json();
    const validated = createReviewCycleSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    // Check for duplicate cycle name within the same company
    const existing = await db.reviewCycle.findFirst({
      where: { companyId, name: validated.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A review cycle with this name already exists' },
        { status: 409 }
      );
    }

    const cycle = await db.$transaction(async (tx) => {
      const created = await tx.reviewCycle.create({
        data: {
          companyId,
          name: validated.name,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          selfReviewDeadline: new Date(validated.selfReviewDeadline),
          peerReviewDeadline: new Date(validated.peerReviewDeadline),
          managerReviewDeadline: new Date(validated.managerReviewDeadline),
          hrReviewDeadline: validated.hrReviewDeadline
            ? new Date(validated.hrReviewDeadline)
            : null,
          isActive: false, // Cycle starts inactive; activation creates reviews
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'CREATE',
          resource: 'ReviewCycle',
          resourceId: created.id,
          after: {
            name: validated.name,
            startDate: validated.startDate,
            endDate: validated.endDate,
            selfReviewDeadline: validated.selfReviewDeadline,
            peerReviewDeadline: validated.peerReviewDeadline,
            managerReviewDeadline: validated.managerReviewDeadline,
            hrReviewDeadline: validated.hrReviewDeadline ?? null,
          },
          ipAddress:
            req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return created;
    });

    return NextResponse.json({ data: cycle }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
