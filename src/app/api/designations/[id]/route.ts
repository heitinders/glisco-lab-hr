import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry, buildChanges } from '@/lib/audit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/designations/[id] — Single designation with salary bands
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const companyId = (session!.user as any).companyId as string;

    const designation = await db.designation.findUnique({
      where: { id },
      include: {
        salaryBands: {
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!designation || designation.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Designation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: designation });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/designations/[id] — Update designation and/or salary bands
// ---------------------------------------------------------------------------

const salaryBandUpdateSchema = z.object({
  region: z.enum(['US', 'INDIA', 'REMOTE']),
  currency: z.string().min(1).max(10),
  min: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

const updateDesignationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  level: z.number().int().min(1).optional(),
  band: z.string().max(50).nullable().optional(),
  salaryBands: z.array(salaryBandUpdateSchema).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const body = await req.json();
    const validated = updateDesignationSchema.parse(body);

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    const existing = await db.designation.findUnique({
      where: { id },
      include: { salaryBands: true },
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Designation not found' },
        { status: 404 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      // Update designation fields
      const designation = await tx.designation.update({
        where: { id },
        data: {
          ...(validated.title !== undefined && { title: validated.title }),
          ...(validated.level !== undefined && { level: validated.level }),
          ...(validated.band !== undefined && { band: validated.band }),
        },
      });

      // Replace salary bands if provided (delete old, insert new)
      if (validated.salaryBands !== undefined) {
        await tx.salaryBand.deleteMany({
          where: { designationId: id },
        });

        if (validated.salaryBands.length > 0) {
          await tx.salaryBand.createMany({
            data: validated.salaryBands.map((sb) => ({
              designationId: id,
              region: sb.region,
              currency: sb.currency,
              minSalary: sb.min,
              midSalary: sb.mid,
              maxSalary: sb.max,
              effectiveFrom: new Date(),
            })),
          });
        }
      }

      // Build audit diff for the designation fields only
      const changes = buildChanges(
        existing as unknown as Record<string, unknown>,
        validated as Record<string, unknown>,
      );

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'UPDATE',
          resource: 'Designation',
          resourceId: id,
          before: changes,
          after: validated.salaryBands
            ? { salaryBandsReplaced: true, newCount: validated.salaryBands.length }
            : null,
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });

      // Re-fetch with includes for the response
      return tx.designation.findUnique({
        where: { id },
        include: {
          salaryBands: {
            orderBy: { effectiveFrom: 'desc' },
          },
          _count: {
            select: { employees: true },
          },
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/designations/[id] — Delete designation (only if no employees)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const companyId = (session!.user as any).companyId as string;
    const actorId = (session!.user as any).employeeId as string;

    const existing = await db.designation.findUnique({
      where: { id },
      include: {
        _count: { select: { employees: true } },
      },
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Designation not found' },
        { status: 404 }
      );
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete designation with assigned employees',
          employeeCount: existing._count.employees,
        },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      // Delete associated salary bands first
      await tx.salaryBand.deleteMany({
        where: { designationId: id },
      });

      await tx.designation.delete({ where: { id } });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId,
          action: 'DELETE',
          resource: 'Designation',
          resourceId: id,
          before: {
            title: existing.title,
            level: existing.level,
            band: existing.band,
          },
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        }),
      });
    });

    return NextResponse.json({ message: 'Designation deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
