import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { updateReviewCycleSchema } from '@/lib/validations/performance';
import { createAuditEntry, buildChanges } from '@/lib/audit';

// ---------------------------------------------------------------------------
// GET /api/performance/cycles/[id]
// ---------------------------------------------------------------------------
// HR+ (performance:view_all): full cycle detail with all reviews.
// Regular employees: only if they are a subject in at least one review in
//   this cycle — returns the cycle plus only their own reviews.
// Includes progress stats: total reviews, count by status.
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

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

    if (!isHrPlus) {
      await checkPermission(session, 'performance:review_self');
    }

    // Fetch cycle with company-scope check
    const cycle = await db.reviewCycle.findUnique({
      where: { id },
      include: {
        reviews: {
          // HR+ sees all reviews; others see only theirs
          ...(!isHrPlus && {
            where: {
              OR: [
                { subjectId: employeeId },
                { reviewerId: employeeId },
              ],
            },
          }),
          include: {
            subject: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: { select: { id: true, name: true } },
              },
            },
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!cycle || cycle.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Review cycle not found' },
        { status: 404 }
      );
    }

    // For non-HR users: verify they actually participate in this cycle
    if (!isHrPlus && cycle.reviews.length === 0) {
      return NextResponse.json(
        { error: 'Review cycle not found' },
        { status: 404 }
      );
    }

    // Build progress stats from ALL reviews (not just the filtered subset)
    const statusCounts = await db.performanceReview.groupBy({
      by: ['status'],
      where: { cycleId: id },
      _count: { status: true },
    });

    const totalReviews = await db.performanceReview.count({
      where: { cycleId: id },
    });

    const progress = {
      total: totalReviews,
      byStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count.status])
      ),
    };

    return NextResponse.json({
      data: {
        ...cycle,
        progress,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/performance/cycles/[id]
// ---------------------------------------------------------------------------
// Permission: performance:manage_cycles (HR_ADMIN+)
//
// Accepts editable fields plus isActive toggle.
// When activating a cycle (isActive transitions false -> true):
//   1. Fetch all ACTIVE employees for the company.
//   2. Create PerformanceReview records:
//      - type SELF:    subjectId = reviewerId = employee.id, status NOT_STARTED
//      - type MANAGER: subjectId = employee, reviewerId = manager (if exists)
//   3. Uses skipDuplicates to safely handle partial re-activations.
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'performance:manage_cycles');

    const body = await req.json();
    const validated = updateReviewCycleSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    // Fetch existing cycle for company-scope check and change tracking
    const existing = await db.reviewCycle.findUnique({ where: { id } });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Review cycle not found' },
        { status: 404 }
      );
    }

    // Detect activation transition: isActive going from false -> true
    const isActivating =
      validated.isActive === true && existing.isActive === false;

    // If dates are partially provided, merge with existing to validate ordering
    if (validated.endDate && !validated.startDate) {
      if (new Date(validated.endDate) <= existing.startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 422 }
        );
      }
    }
    if (validated.startDate && !validated.endDate) {
      if (existing.endDate <= new Date(validated.startDate)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 422 }
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Build update data — only include fields that were actually provided
      const updateData: Record<string, unknown> = {};

      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.startDate !== undefined) updateData.startDate = new Date(validated.startDate);
      if (validated.endDate !== undefined) updateData.endDate = new Date(validated.endDate);
      if (validated.selfReviewDeadline !== undefined)
        updateData.selfReviewDeadline = new Date(validated.selfReviewDeadline);
      if (validated.peerReviewDeadline !== undefined)
        updateData.peerReviewDeadline = new Date(validated.peerReviewDeadline);
      if (validated.managerReviewDeadline !== undefined)
        updateData.managerReviewDeadline = new Date(validated.managerReviewDeadline);
      if (validated.hrReviewDeadline !== undefined) {
        updateData.hrReviewDeadline = validated.hrReviewDeadline
          ? new Date(validated.hrReviewDeadline)
          : null;
      }
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

      const cycle = await tx.reviewCycle.update({
        where: { id },
        data: updateData,
      });

      // ---- Activation: auto-create review records ----
      if (isActivating) {
        const activeEmployees = await tx.employee.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            reportingToId: true,
          },
        });

        // Collect all review records to create
        const reviewRecords: Array<{
          cycleId: string;
          subjectId: string;
          reviewerId: string;
          type: string;
          status: 'NOT_STARTED';
        }> = [];

        for (const employee of activeEmployees) {
          // Self review: subject = reviewer = employee
          reviewRecords.push({
            cycleId: id,
            subjectId: employee.id,
            reviewerId: employee.id,
            type: 'SELF',
            status: 'NOT_STARTED',
          });

          // Manager review: only if employee has a reporting manager
          if (employee.reportingToId) {
            reviewRecords.push({
              cycleId: id,
              subjectId: employee.id,
              reviewerId: employee.reportingToId,
              type: 'MANAGER',
              status: 'NOT_STARTED',
            });
          }
        }

        if (reviewRecords.length > 0) {
          await tx.performanceReview.createMany({
            data: reviewRecords,
            skipDuplicates: true, // Safe for re-activation edge cases
          });
        }
      }

      // ---- Audit log ----
      const changes = buildChanges(
        existing as unknown as Record<string, unknown>,
        {
          ...validated,
          ...(isActivating && { _reviewsCreated: true }),
        } as Record<string, unknown>,
      );

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'UPDATE',
          resource: 'ReviewCycle',
          resourceId: id,
          before: changes,
          after: isActivating
            ? { activated: true, reviewsGenerated: true }
            : null,
          ipAddress:
            req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return cycle;
    });

    // If we activated, include the count of generated reviews in the response
    if (isActivating) {
      const reviewCount = await db.performanceReview.count({
        where: { cycleId: id },
      });

      return NextResponse.json({
        data: updated,
        meta: { reviewsCreated: reviewCount },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
