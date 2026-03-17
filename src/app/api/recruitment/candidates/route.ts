import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createCandidateSchema } from '@/lib/validations/recruitment';
import { createAuditEntry } from '@/lib/audit';

// ---------------------------------------------------------------------------
// GET /api/recruitment/candidates — List candidates with filtering & search
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:view');

    const companyId = (session!.user as any).companyId as string;

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || undefined;
    const stage = searchParams.get('stage') || undefined;
    const source = searchParams.get('source') || undefined;
    const search = searchParams.get('search') || undefined;
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

    // Validate sort field to prevent injection
    const allowedSortFields = ['createdAt', 'rating', 'stage'] as const;
    const sortField = allowedSortFields.includes(sort as any) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const where: any = {
      job: { companyId },
      ...(jobId && { jobId }),
      ...(stage && { stage }),
      ...(source && { source }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [candidates, total] = await Promise.all([
      db.candidate.findMany({
        where,
        include: {
          job: { select: { title: true, status: true, companyId: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortField]: sortOrder },
      }),
      db.candidate.count({ where }),
    ]);

    return NextResponse.json({
      data: candidates,
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
// POST /api/recruitment/candidates — Create a new candidate
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'recruitment:manage_candidates');

    const body = await req.json();
    const validatedData = createCandidateSchema.parse(body);

    const sessionUser = session!.user as any;
    const companyId = sessionUser.companyId as string;
    const employeeId = sessionUser.employeeId as string;

    // Verify the job exists and belongs to the session's company
    const job = await db.job.findUnique({
      where: { id: validatedData.jobId },
      select: { id: true, companyId: true, status: true },
    });

    if (!job || job.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    // Verify the job is OPEN — cannot add candidates to DRAFT/CLOSED/FILLED jobs
    if (job.status !== 'OPEN') {
      return NextResponse.json(
        { error: `Cannot add candidates to a job with status '${job.status}'. Job must be OPEN.` },
        { status: 409 },
      );
    }

    // Check for duplicate email within the same job
    const existingCandidate = await db.candidate.findFirst({
      where: {
        jobId: validatedData.jobId,
        email: validatedData.email,
      },
    });

    if (existingCandidate) {
      return NextResponse.json(
        { error: 'A candidate with this email already exists for this job' },
        { status: 409 },
      );
    }

    // Create candidate with atomic audit log
    // Using $transaction directly so resourceId can be set after candidate creation
    const candidate = await db.$transaction(async (tx) => {
      const created = await tx.candidate.create({
        data: {
          jobId: validatedData.jobId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phone: validatedData.phone ?? null,
          resumeUrl: validatedData.resumeUrl ?? null,
          coverLetterUrl: validatedData.coverLetterUrl ?? null,
          source: validatedData.source ?? null,
          referredById: validatedData.referredById ?? null,
          notes: validatedData.notes ?? null,
          tags: validatedData.tags ?? [],
          stage: 'APPLIED',
        },
        include: {
          job: { select: { title: true, status: true, companyId: true } },
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId: job.companyId,
          actorId: employeeId,
          action: 'CREATE',
          resource: 'Candidate',
          resourceId: created.id,
          after: {
            jobId: validatedData.jobId,
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            email: validatedData.email,
            source: validatedData.source ?? null,
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      // TODO: Queue AI assessment job if resumeUrl is provided
      // e.g. await assessmentQueue.add('assess-candidate', { candidateId: created.id })

      return created;
    });

    return NextResponse.json({ data: candidate }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
