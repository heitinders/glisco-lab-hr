import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { withAudit, buildChanges } from '@/lib/audit';
import { updateJobSchema } from '@/lib/validations/recruitment';
import { type JobStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------
// DRAFT  -> OPEN
// OPEN   -> ON_HOLD, CLOSED, FILLED
// ON_HOLD -> OPEN, CLOSED, FILLED
// CLOSED -> OPEN, FILLED
// Any    -> FILLED (terminal state reachable from OPEN, ON_HOLD, CLOSED)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['OPEN', 'FILLED'],
  OPEN: ['ON_HOLD', 'CLOSED', 'FILLED'],
  ON_HOLD: ['OPEN', 'CLOSED', 'FILLED'],
  CLOSED: ['OPEN', 'FILLED'],
  FILLED: [], // terminal — no outgoing transitions
};

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/recruitment/jobs/[id]
// ---------------------------------------------------------------------------
// Returns a single job with designation, department, and candidate stage
// counts. Scoped to the session user's company.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:view');

    const companyId = (session!.user as any).companyId as string;
    const { id } = await context.params;

    const job = await db.job.findFirst({
      where: { id, companyId },
      include: {
        designation: { select: { title: true } },
        department: { select: { name: true } },
        candidates: {
          select: { stage: true },
        },
        _count: { select: { candidates: true } },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    // Compute candidate counts grouped by stage
    const stageCounts: Record<string, number> = {};
    for (const candidate of job.candidates) {
      stageCounts[candidate.stage] = (stageCounts[candidate.stage] || 0) + 1;
    }

    // Strip raw candidates array — return aggregated counts instead
    const { candidates, ...jobData } = job;

    return NextResponse.json({
      data: {
        ...jobData,
        candidateStageCounts: stageCounts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/recruitment/jobs/[id]
// ---------------------------------------------------------------------------
// Updates a job posting. Enforces valid status transitions. When status
// moves to OPEN for the first time, postedAt is set automatically.
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage');

    const companyId = (session!.user as any).companyId as string;
    const employeeId = (session!.user as any).employeeId as string | undefined;
    const { id } = await context.params;

    const body = await req.json();
    const validated = updateJobSchema.parse(body);

    // Fetch current state — needed for transition check and audit diff
    const existing = await db.job.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    // --- Status transition guard ---
    if (validated.status && validated.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status];
      if (!allowed.includes(validated.status as JobStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${existing.status} to ${validated.status}`,
            allowedTransitions: allowed,
          },
          { status: 422 },
        );
      }
    }

    // Build the data payload, applying auto-set fields
    const updateData: Record<string, unknown> = { ...validated };

    // Auto-set postedAt when transitioning to OPEN for the first time
    if (validated.status === 'OPEN' && !existing.postedAt) {
      updateData.postedAt = new Date();
    }

    // Convert closesAt string to Date if present
    if (validated.closesAt !== undefined) {
      updateData.closesAt = validated.closesAt ? new Date(validated.closesAt) : null;
    }

    const changes = buildChanges(
      existing as unknown as Record<string, unknown>,
      { ...existing, ...updateData } as unknown as Record<string, unknown>,
    );

    const auditParams = {
      companyId,
      actorId: employeeId ?? null,
      action: 'UPDATE' as const,
      resource: 'Job',
      resourceId: id,
      before: existing as unknown as Record<string, unknown>,
      after: changes,
    };

    const updated = await withAudit(auditParams, async (tx) => {
      return tx.job.update({
        where: { id },
        data: updateData,
        include: {
          designation: { select: { title: true } },
          department: { select: { name: true } },
          _count: { select: { candidates: true } },
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/recruitment/jobs/[id]
// ---------------------------------------------------------------------------
// Hard-deletes a job posting. Only DRAFT jobs with zero candidates may be
// deleted — all other states require archiving (status -> CLOSED) instead.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage');

    const companyId = (session!.user as any).companyId as string;
    const employeeId = (session!.user as any).employeeId as string | undefined;
    const { id } = await context.params;

    const existing = await db.job.findFirst({
      where: { id, companyId },
      include: { _count: { select: { candidates: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT jobs can be deleted. Change the status to CLOSED to archive.' },
        { status: 422 },
      );
    }

    if (existing._count.candidates > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a job that has candidates. Remove all candidates first or close the job instead.' },
        { status: 422 },
      );
    }

    const auditParams = {
      companyId,
      actorId: employeeId ?? null,
      action: 'DELETE' as const,
      resource: 'Job',
      resourceId: id,
      before: existing as unknown as Record<string, unknown>,
    };

    await withAudit(auditParams, async (tx) => {
      await tx.job.delete({ where: { id } });
    });

    return NextResponse.json({ message: 'Job deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
