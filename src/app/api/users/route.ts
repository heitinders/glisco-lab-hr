import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'users:list');

    const companyId = (session!.user as any).companyId as string;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || '20'),
      100,
    );
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || undefined;
    const isActive = searchParams.get('isActive');

    const where: any = {
      companyId,
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          {
            employee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
      ...(role && { role }),
      ...(isActive !== null &&
        isActive !== undefined &&
        isActive !== '' && {
          isActive: isActive === 'true',
        }),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
