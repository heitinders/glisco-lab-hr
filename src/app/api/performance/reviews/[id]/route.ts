import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { createAuditEntry } from '@/lib/audit';
import {
  selfReviewSubmissionSchema,
  managerReviewSubmissionSchema,
  hrReviewSubmissionSchema,
} from '@/lib/validations/performance';

// ---------------------------------------------------------------------------
// GET /api/performance/reviews/[id] — Fetch a single performance review
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { id } = await params;

    const userRole = (session.user as any).role as string;
    const employeeId = (session.user as any).employeeId as string;
    const companyId = (session.user as any).companyId as string;

    const review = await db.performanceReview.findUnique({
      where: { id },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            selfReviewDeadline: true,
            peerReviewDeadline: true,
            managerReviewDeadline: true,
          },
        },
        subject: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 },
      );
    }

    // Participant check: subject, reviewer, or HR+ roles
    const isSubject = review.subjectId === employeeId;
    const isReviewer = review.reviewerId === employeeId;
    const isHrOrAdmin = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(userRole);

    if (!isSubject && !isReviewer && !isHrOrAdmin) {
      return NextResponse.json(
        { error: 'You do not have access to this review' },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: review });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/performance/reviews/[id] — Submit a stage-specific review
// ---------------------------------------------------------------------------
//
// Handles three submission flows:
//   1. SELF_REVIEW   — employee submits their self-assessment
//   2. MANAGER_REVIEW — manager submits evaluation of direct report
//   3. HR_REVIEW     — HR provides final rating override
//
// Each flow has its own Zod schema, ownership/permission checks, status
// transitions, and atomic audit logging.
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    const userRole = (session.user as any).role as string;
    const employeeId = (session.user as any).employeeId as string;
    const companyId = (session.user as any).companyId as string;

    // Fetch the review to determine the correct submission flow
    const review = await db.performanceReview.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 },
      );
    }

    // ── Route to the correct submission handler based on review type
    switch (review.type) {
      case 'SELF':
        return handleSelfReviewSubmission(req, review, body, employeeId, companyId);
      case 'MANAGER':
        return handleManagerReviewSubmission(req, review, body, employeeId, companyId);
      case 'HR':
        return handleHrReviewSubmission(req, review, body, employeeId, companyId, userRole, session);
      default:
        return NextResponse.json(
          { error: `Submission not supported for review type '${review.type}'` },
          { status: 400 },
        );
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// SELF_REVIEW — Employee submitting their self-assessment
// ---------------------------------------------------------------------------

async function handleSelfReviewSubmission(
  req: NextRequest,
  review: {
    id: string;
    cycleId: string;
    subjectId: string;
    reviewerId: string;
    type: string;
    status: string;
    ratings: any;
    submittedAt: Date | null;
  },
  body: unknown,
  employeeId: string,
  companyId: string,
) {
  // Ownership: only the subject can submit their own self-review
  if (review.subjectId !== employeeId) {
    return NextResponse.json(
      { error: 'You can only submit your own self-review' },
      { status: 403 },
    );
  }

  // Guard: cannot re-submit an already submitted self-review
  if (review.submittedAt !== null) {
    return NextResponse.json(
      { error: 'This self-review has already been submitted' },
      { status: 409 },
    );
  }

  // Validate payload
  const parsed = selfReviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { selfRating, strengths, improvements, comments } = parsed.data;

  // Merge rating into existing ratings JSON
  const existingRatings =
    typeof review.ratings === 'object' && review.ratings !== null
      ? (review.ratings as Record<string, unknown>)
      : {};

  const updatedRatings = { ...existingRatings, selfRating };

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    // (a) Update the self-review record
    const updatedReview = await tx.performanceReview.update({
      where: { id: review.id },
      data: {
        ratings: updatedRatings,
        strengths: strengths ?? null,
        improvements: improvements ?? null,
        comments: comments ?? null,
        status: 'SELF_REVIEW',
        submittedAt: now,
      },
    });

    // (b) Advance the MANAGER review for the same cycle+subject to MANAGER_REVIEW
    //     so the manager's dashboard shows it as ready for evaluation.
    await tx.performanceReview.updateMany({
      where: {
        cycleId: review.cycleId,
        subjectId: review.subjectId,
        type: 'MANAGER',
      },
      data: {
        status: 'MANAGER_REVIEW',
      },
    });

    // (c) Audit log
    await tx.auditLog.create({
      data: createAuditEntry({
        companyId,
        actorId: employeeId,
        action: 'UPDATE',
        resource: 'PerformanceReview',
        resourceId: review.id,
        before: { status: review.status },
        after: {
          status: 'SELF_REVIEW',
          selfRating,
          submittedAt: now.toISOString(),
        },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      }),
    });

    return updatedReview;
  });

  return NextResponse.json({ data: updated });
}

// ---------------------------------------------------------------------------
// MANAGER_REVIEW — Manager evaluating their direct report
// ---------------------------------------------------------------------------

async function handleManagerReviewSubmission(
  req: NextRequest,
  review: {
    id: string;
    cycleId: string;
    subjectId: string;
    reviewerId: string;
    type: string;
    status: string;
    ratings: any;
    submittedAt: Date | null;
  },
  body: unknown,
  employeeId: string,
  companyId: string,
) {
  // Ownership: only the assigned reviewer (manager) can submit
  if (review.reviewerId !== employeeId) {
    return NextResponse.json(
      { error: 'You are not the assigned reviewer for this review' },
      { status: 403 },
    );
  }

  // Guard: the self-review must have been submitted first (status = MANAGER_REVIEW)
  if (review.status !== 'MANAGER_REVIEW') {
    return NextResponse.json(
      { error: 'Self-review must be completed before manager review can be submitted' },
      { status: 409 },
    );
  }

  // Guard: cannot re-submit
  if (review.submittedAt !== null) {
    return NextResponse.json(
      { error: 'This manager review has already been submitted' },
      { status: 409 },
    );
  }

  // Validate payload
  const parsed = managerReviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { managerRating, strengths, improvements, comments } = parsed.data;

  // Merge rating into existing ratings JSON
  const existingRatings =
    typeof review.ratings === 'object' && review.ratings !== null
      ? (review.ratings as Record<string, unknown>)
      : {};

  const updatedRatings = { ...existingRatings, managerRating };

  // Calculate overall rating: average of self + manager ratings
  // Retrieve the SELF review to get selfRating for the average
  const selfReview = await db.performanceReview.findFirst({
    where: {
      cycleId: review.cycleId,
      subjectId: review.subjectId,
      type: 'SELF',
    },
    select: { ratings: true },
  });

  const selfRating =
    selfReview?.ratings &&
    typeof selfReview.ratings === 'object' &&
    selfReview.ratings !== null
      ? (selfReview.ratings as Record<string, unknown>).selfRating
      : null;

  const overallRating =
    typeof selfRating === 'number'
      ? parseFloat(((selfRating + managerRating) / 2).toFixed(2))
      : managerRating;

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    // (a) Update the manager review record
    const updatedReview = await tx.performanceReview.update({
      where: { id: review.id },
      data: {
        ratings: updatedRatings,
        strengths: strengths ?? null,
        improvements: improvements ?? null,
        comments: comments ?? null,
        overallRating,
        status: 'COMPLETED',
        submittedAt: now,
      },
    });

    // (b) Audit log
    await tx.auditLog.create({
      data: createAuditEntry({
        companyId,
        actorId: employeeId,
        action: 'UPDATE',
        resource: 'PerformanceReview',
        resourceId: review.id,
        before: { status: review.status },
        after: {
          status: 'COMPLETED',
          managerRating,
          overallRating,
          submittedAt: now.toISOString(),
        },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      }),
    });

    return updatedReview;
  });

  return NextResponse.json({ data: updated });
}

// ---------------------------------------------------------------------------
// HR_REVIEW — HR final review with rating override
// ---------------------------------------------------------------------------

async function handleHrReviewSubmission(
  req: NextRequest,
  review: {
    id: string;
    cycleId: string;
    subjectId: string;
    reviewerId: string;
    type: string;
    status: string;
    ratings: any;
    submittedAt: Date | null;
  },
  body: unknown,
  employeeId: string,
  companyId: string,
  userRole: string,
  session: { user?: { role?: string } } | null,
) {
  // RBAC: only users with performance:manage_cycles can submit HR reviews
  await checkPermission(session, 'performance:manage_cycles');

  // Validate payload
  const parsed = hrReviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { finalRating, comments } = parsed.data;

  // Merge rating into existing ratings JSON
  const existingRatings =
    typeof review.ratings === 'object' && review.ratings !== null
      ? (review.ratings as Record<string, unknown>)
      : {};

  const updatedRatings = { ...existingRatings, finalRating };

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    // (a) Update the HR review record — finalRating overrides overallRating
    const updatedReview = await tx.performanceReview.update({
      where: { id: review.id },
      data: {
        ratings: updatedRatings,
        comments: comments ?? null,
        overallRating: finalRating,
        status: 'COMPLETED',
        submittedAt: now,
      },
    });

    // (b) Audit log
    await tx.auditLog.create({
      data: createAuditEntry({
        companyId,
        actorId: employeeId,
        action: 'APPROVE',
        resource: 'PerformanceReview',
        resourceId: review.id,
        before: { status: review.status },
        after: {
          status: 'COMPLETED',
          finalRating,
          overallRating: finalRating,
          submittedAt: now.toISOString(),
        },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      }),
    });

    return updatedReview;
  });

  return NextResponse.json({ data: updated });
}
