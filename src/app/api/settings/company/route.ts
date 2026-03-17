import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { withAudit, buildChanges } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        cin: true,
        ein: true,
        gstIn: true,
        address: true,
        logoUrl: true,
        primaryColor: true,
        fiscalYearStart: true,
        timezone: true,
        region: true,
        settings: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'settings:manage');

    const companyId = (session!.user as any).companyId;
    const body = await req.json();

    const existing = await db.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      'name', 'legalName', 'cin', 'ein', 'gstIn', 'address',
      'logoUrl', 'primaryColor', 'fiscalYearStart', 'timezone', 'region', 'settings',
    ];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await withAudit(
      {
        companyId,
        actorId: (session!.user as any).id,
        action: 'UPDATE',
        resource: 'Company',
        resourceId: companyId,
        before: existing as any,
        after: updateData,
      },
      async (tx) => {
        return tx.company.update({
          where: { id: companyId },
          data: updateData,
        });
      },
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
