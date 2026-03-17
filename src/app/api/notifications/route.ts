import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = (session.user as any).employeeId;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: any = {
      employeeId,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({
        where: { employeeId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = (session.user as any).employeeId;
    const body = await req.json();
    const { ids, markAllRead } = body;

    if (markAllRead) {
      await db.notification.updateMany({
        where: { employeeId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (ids?.length) {
      await db.notification.updateMany({
        where: { id: { in: ids }, employeeId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
