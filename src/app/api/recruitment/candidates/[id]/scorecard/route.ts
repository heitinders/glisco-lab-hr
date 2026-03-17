import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { scorecardSchema } from '@/lib/validations/recruitment';
import { withAudit } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Scorecard type for the JSON array stored on the Candidate model
// ---------------------------------------------------------------------------

interface Scorecard {
  interviewerId: string;
  criteria: { name: string; rating: number; notes?: string }[];
  overallRecommendation: string;
  summary?: string | null;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// GET /api/recruitment/candidates/[id]/scorecard — List all scorecards
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
      select: {
        id: true,
        scorecards: true,
        rating: true,
        job: { select: { companyId: true } },
      },
    });

    if (!candidate || candidate.job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    const scorecards = Array.isArray(candidate.scorecards)
      ? candidate.scorecards
      : [];

    return NextResponse.json({
      data: {
        candidateId: candidate.id,
        scorecards,
        averageRating: candidate.rating,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/recruitment/candidates/[id]/scorecard — Add a scorecard
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage_candidates');

    const { id } = await params;
    const body = await req.json();

    // Inject candidateId from the URL param so the schema validates it
    const validatedData = scorecardSchema.parse({ ...body, candidateId: id });

    const sessionUser = session!.user as any;
    const companyId = sessionUser.companyId as string;
    const employeeId = sessionUser.employeeId as string;

    // Fetch candidate with existing scorecards
    const candidate = await db.candidate.findUnique({
      where: { id },
      select: {
        id: true,
        scorecards: true,
        rating: true,
        job: { select: { companyId: true } },
      },
    });

    if (!candidate || candidate.job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    // Build the new scorecard entry
    const newScorecard: Scorecard = {
      interviewerId: validatedData.interviewerId,
      criteria: validatedData.criteria,
      overallRecommendation: validatedData.overallRecommendation,
      summary: validatedData.summary ?? null,
      submittedAt: new Date().toISOString(),
    };

    // Append to existing scorecards array
    const existingScorecards: Scorecard[] = Array.isArray(candidate.scorecards)
      ? (candidate.scorecards as unknown as Scorecard[])
      : [];
    const updatedScorecards = [...existingScorecards, newScorecard];

    // Calculate average rating from all scorecards
    // Each scorecard's rating = average of its criteria ratings
    const scorecardRatings = updatedScorecards.map((sc) => {
      if (!sc.criteria || sc.criteria.length === 0) return 0;
      const sum = sc.criteria.reduce((acc, c) => acc + c.rating, 0);
      return sum / sc.criteria.length;
    });
    const averageRating =
      scorecardRatings.length > 0
        ? Math.round(
            scorecardRatings.reduce((acc, r) => acc + r, 0) /
              scorecardRatings.length,
          )
        : null;

    const updated = await withAudit(
      {
        companyId: candidate.job.companyId,
        actorId: employeeId,
        action: 'UPDATE',
        resource: 'Candidate',
        resourceId: id,
        before: {
          scorecardCount: existingScorecards.length,
          rating: candidate.rating,
        },
        after: {
          scorecardCount: updatedScorecards.length,
          rating: averageRating,
          addedBy: validatedData.interviewerId,
          recommendation: validatedData.overallRecommendation,
        },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
      async (tx) => {
        return tx.candidate.update({
          where: { id },
          data: {
            scorecards: updatedScorecards as any,
            rating: averageRating,
          },
          select: {
            id: true,
            scorecards: true,
            rating: true,
          },
        });
      },
    );

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
