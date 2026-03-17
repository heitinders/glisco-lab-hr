import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/designations — List all designations for the company
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const companyId = (session!.user as any).companyId as string;

    const designations = await db.designation.findMany({
      where: { companyId },
      include: {
        salaryBands: {
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });

    return NextResponse.json({ data: designations });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/designations — Create a new designation with optional salary bands
// ---------------------------------------------------------------------------

const salaryBandSchema = z.object({
  region: z.enum(['US', 'INDIA', 'REMOTE']),
  currency: z.string().min(1).max(10),
  min: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

const createDesignationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  level: z.number().int().min(1),
  band: z.string().max(50).optional(),
  salaryBands: z.array(salaryBandSchema).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const body = await req.json();
    const validated = createDesignationSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    const designation = await db.$transaction(async (tx) => {
      const created = await tx.designation.create({
        data: {
          companyId,
          title: validated.title,
          level: validated.level,
          band: validated.band ?? null,
          ...(validated.salaryBands && validated.salaryBands.length > 0
            ? {
                salaryBands: {
                  createMany: {
                    data: validated.salaryBands.map((sb) => ({
                      region: sb.region,
                      currency: sb.currency,
                      minSalary: sb.min,
                      midSalary: sb.mid,
                      maxSalary: sb.max,
                      effectiveFrom: new Date(),
                    })),
                  },
                },
              }
            : {}),
        },
        include: {
          salaryBands: true,
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'CREATE',
          resource: 'Designation',
          resourceId: created.id,
          after: {
            title: validated.title,
            level: validated.level,
            band: validated.band ?? null,
            salaryBandsCount: validated.salaryBands?.length ?? 0,
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      return created;
    });

    return NextResponse.json({ data: designation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
