import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'payroll:view_all');

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const status = searchParams.get('status') || undefined;
    const region = searchParams.get('region') || undefined;

    const where: any = {
      ...(status && { status }),
      ...(region && { region }),
    };

    const [runs, total] = await Promise.all([
      db.payrollRun.findMany({
        where,
        include: {
          _count: { select: { payslips: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.payrollRun.count({ where }),
    ]);

    return NextResponse.json({
      data: runs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
