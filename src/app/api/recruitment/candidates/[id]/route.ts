import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { updateCandidateStageSchema } from '@/lib/validations/recruitment';
import { withAudit, buildChanges } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Valid stage transitions map
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ['SCREENING', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['PHONE_INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  PHONE_INTERVIEW: ['TECHNICAL', 'REJECTED', 'WITHDRAWN'],
  TECHNICAL: ['FINAL_INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  FINAL_INTERVIEW: ['OFFER_SENT', 'REJECTED', 'WITHDRAWN'],
  OFFER_SENT: ['OFFER_ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  OFFER_ACCEPTED: ['HIRED', 'WITHDRAWN'],
  // Terminal states — no further transitions
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

// ---------------------------------------------------------------------------
// GET /api/recruitment/candidates/[id] — Fetch a single candidate
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:view');

    const { id } = await params;
    const companyId = (session!.user as any).companyId as string;

    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            title: true,
            departmentId: true,
            status: true,
            companyId: true,
          },
        },
      },
    });

    if (!candidate || candidate.job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: candidate });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/recruitment/candidates/[id] — Update candidate stage
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage_candidates');

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateCandidateStageSchema.parse(body);

    const sessionUser = session!.user as any;
    const companyId = sessionUser.companyId as string;
    const employeeId = sessionUser.employeeId as string;

    // Fetch existing candidate with job relation for company verification
    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        job: { select: { companyId: true } },
      },
    });

    if (!candidate || candidate.job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    const currentStage = candidate.stage;
    const newStage = validatedData.stage;

    // Validate stage transition
    const allowedTransitions = VALID_TRANSITIONS[currentStage] ?? [];
    if (!allowedTransitions.includes(newStage)) {
      return NextResponse.json(
        {
          error: `Invalid stage transition from '${currentStage}' to '${newStage}'`,
          allowedTransitions,
        },
        { status: 422 },
      );
    }

    // When transitioning to REJECTED, rejectedReason is required
    if (newStage === 'REJECTED' && !validatedData.rejectedReason) {
      return NextResponse.json(
        { error: 'rejectedReason is required when rejecting a candidate' },
        { status: 422 },
      );
    }

    // Build the update payload
    const updateData: Record<string, unknown> = {
      stage: newStage,
      ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      ...(validatedData.rating !== undefined && { rating: validatedData.rating }),
      ...(validatedData.rejectedReason !== undefined && {
        rejectedReason: validatedData.rejectedReason,
      }),
    };

    // Auto-set timestamps based on stage transition
    if (newStage === 'OFFER_SENT') {
      updateData.offerSentAt = new Date();
    }
    if (newStage === 'HIRED') {
      updateData.hiredAt = new Date();
    }

    // Compute field-level diff for audit trail
    const oldRecord: Record<string, unknown> = {
      stage: candidate.stage,
      notes: candidate.notes,
      rating: candidate.rating,
      rejectedReason: candidate.rejectedReason,
      offerSentAt: candidate.offerSentAt,
      hiredAt: candidate.hiredAt,
    };

    const changes = buildChanges(oldRecord, updateData);

    const updated = await withAudit(
      {
        companyId: candidate.job.companyId,
        actorId: employeeId,
        action: 'UPDATE',
        resource: 'Candidate',
        resourceId: id,
        before: changes,
        after: null,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
      async (tx) => {
        return tx.candidate.update({
          where: { id },
          data: updateData,
          include: {
            job: { select: { title: true, status: true, companyId: true } },
          },
        });
      },
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/recruitment/candidates/[id] — Delete an APPLIED-stage candidate
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage_candidates');

    const { id } = await params;

    const sessionUser = session!.user as any;
    const companyId = sessionUser.companyId as string;
    const employeeId = sessionUser.employeeId as string;

    // Fetch candidate with job for company verification
    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        job: { select: { companyId: true } },
      },
    });

    if (!candidate || candidate.job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    // Only allow deleting candidates in the APPLIED stage
    if (candidate.stage !== 'APPLIED') {
      return NextResponse.json(
        {
          error: `Cannot delete candidate in '${candidate.stage}' stage. Only APPLIED candidates can be deleted.`,
        },
        { status: 409 },
      );
    }

    await withAudit(
      {
        companyId: candidate.job.companyId,
        actorId: employeeId,
        action: 'DELETE',
        resource: 'Candidate',
        resourceId: id,
        before: {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          jobId: candidate.jobId,
          stage: candidate.stage,
        },
        after: null,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
      async (tx) => {
        return tx.candidate.delete({ where: { id } });
      },
    );

    return NextResponse.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
