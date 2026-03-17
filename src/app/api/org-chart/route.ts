import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

// ---------------------------------------------------------------------------
// GET /api/org-chart — All active employees for org chart tree
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'employee:read');

    const companyId = (session!.user as any).companyId as string;

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department') || undefined;

    const employees = await db.employee.findMany({
      where: {
        companyId,
        status: { in: ['ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD'] },
        ...(departmentId && { departmentId }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        profilePhotoUrl: true,
        reportingToId: true,
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, title: true, level: true } },
        status: true,
      },
      orderBy: [{ designation: { level: 'asc' } }, { firstName: 'asc' }],
    });

    return NextResponse.json({ data: employees });
  } catch (error) {
    return handleApiError(error);
  }
}
