import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Temporary debug endpoint — DELETE after login is fixed
export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. AUTH_SECRET present?
  checks.authSecret = !!process.env.AUTH_SECRET;
  checks.nextauthSecret = !!process.env.NEXTAUTH_SECRET;
  checks.authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'NOT SET';

  // 2. Can we reach the DB?
  try {
    const userCount = await db.user.count();
    checks.dbConnected = true;
    checks.userCount = userCount;
  } catch (e: any) {
    checks.dbConnected = false;
    checks.dbError = e.message;
  }

  // 3. Does admin user exist?
  try {
    const admin = await db.user.findUnique({
      where: { email: 'admin@gliscolab.com' },
      select: { id: true, email: true, role: true, passwordHash: !!true as any },
    });
    checks.adminExists = !!admin;
    checks.adminHasPassword = !!admin?.passwordHash;
  } catch (e: any) {
    checks.adminLookupError = e.message;
  }

  return NextResponse.json(checks);
}
