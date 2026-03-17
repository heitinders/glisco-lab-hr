import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'audit:view');

    const companyId = (session!.user as any).companyId as string;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || '20'),
      100,
    );
    const action = searchParams.get('action') || undefined;
    const resource = searchParams.get('resource') || undefined;
    const actorId = searchParams.get('actorId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const where: any = {
      companyId,
      ...(action && { action }),
      ...(resource && { resource }),
      ...(actorId && { actorId }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && {
            lte: new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1),
          }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
