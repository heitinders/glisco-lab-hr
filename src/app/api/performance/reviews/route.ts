import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { createPeerReviewSchema } from '@/lib/validations/performance';

// ---------------------------------------------------------------------------
// GET /api/performance/reviews — List reviews visible to the current user
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Any authenticated user can view their own reviews
    await checkPermission(session, 'performance:review_self');

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId') || undefined;
    const employeeId = (session!.user as any).employeeId;
    const userRole = (session!.user as any).role;

    const where: any = {
      ...(cycleId && { cycleId }),
    };

    // Non-admin users see only their own reviews
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole)) {
      where.OR = [{ subjectId: employeeId }, { reviewerId: employeeId }];
    }

    const reviews = await db.performanceReview.findMany({
      where,
      include: {
        cycle: { select: { name: true } },
        subject: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
        reviewer: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: reviews });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/performance/reviews — Create a peer review assignment (HR only)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // Only HR admins can create peer review assignments
    await checkPermission(session, 'performance:manage_cycles');

    const body = await req.json();

    // Validate payload
    const parsed = createPeerReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { cycleId, subjectId, reviewerId, type } = parsed.data;

    const employeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;

    // Validate that the review cycle exists and is active
    const cycle = await db.reviewCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      return NextResponse.json(
        { error: 'Review cycle not found' },
        { status: 404 },
      );
    }

    // Prevent self-assignment: reviewer and subject must be different
    if (subjectId === reviewerId) {
      return NextResponse.json(
        { error: 'Reviewer cannot be the same person as the review subject' },
        { status: 422 },
      );
    }

    // Verify both subject and reviewer employees exist within the same company
    const [subject, reviewer] = await Promise.all([
      db.employee.findUnique({
        where: { id: subjectId },
        select: { id: true, companyId: true },
      }),
      db.employee.findUnique({
        where: { id: reviewerId },
        select: { id: true, companyId: true },
      }),
    ]);

    if (!subject || subject.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Subject employee not found' },
        { status: 404 },
      );
    }

    if (!reviewer || reviewer.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Reviewer employee not found' },
        { status: 404 },
      );
    }

    // Check for duplicate peer review assignment
    const existingReview = await db.performanceReview.findUnique({
      where: {
        cycleId_subjectId_reviewerId_type: {
          cycleId,
          subjectId,
          reviewerId,
          type,
        },
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'A peer review assignment already exists for this cycle, subject, and reviewer' },
        { status: 409 },
      );
    }

    // Create the peer review within a transaction alongside the audit log
    const newReview = await db.$transaction(async (tx) => {
      const review = await tx.performanceReview.create({
        data: {
          cycleId,
          subjectId,
          reviewerId,
          type,
          status: 'PEER_REVIEW',
          ratings: {},
        },
        include: {
          cycle: { select: { name: true } },
          subject: {
            select: { firstName: true, lastName: true, employeeId: true },
          },
          reviewer: {
            select: { firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: employeeId,
          action: 'CREATE',
          resource: 'PerformanceReview',
          resourceId: review.id,
          after: {
            cycleId,
            subjectId,
            reviewerId,
            type,
            status: 'PEER_REVIEW',
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return review;
    });

    return NextResponse.json({ data: newReview }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
