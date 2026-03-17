import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

// Temporary debug endpoint — DELETE after login is fixed
export async function GET(req: Request) {
  const checks: Record<string, unknown> = {};

  // 1. Environment
  checks.env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_SECRET_LENGTH: process.env.AUTH_SECRET?.length ?? 0,
    NEXTAUTH_SECRET_LENGTH: process.env.NEXTAUTH_SECRET?.length ?? 0,
    AUTH_URL: process.env.AUTH_URL ?? 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'NOT SET',
    VERCEL_URL: process.env.VERCEL_URL ?? 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 30) + '...',
  };

  // 2. Request info (cookie/host diagnostics)
  checks.request = {
    host: req.headers.get('host'),
    origin: req.headers.get('origin'),
    forwardedHost: req.headers.get('x-forwarded-host'),
    forwardedProto: req.headers.get('x-forwarded-proto'),
    cookies: req.headers.get('cookie')
      ?.split(';')
      .map((c) => c.trim().split('=')[0])
      .filter((name) => name.includes('auth') || name.includes('next') || name.includes('session'))
      ?? [],
  };

  // 3. DB connectivity
  try {
    const t0 = Date.now();
    const userCount = await db.user.count();
    checks.db = {
      connected: true,
      latencyMs: Date.now() - t0,
      userCount,
    };
  } catch (e: any) {
    checks.db = { connected: false, error: e.message };
  }

  // 4. Admin user check
  try {
    const admin = await db.user.findUnique({
      where: { email: 'admin@gliscolab.com' },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        loginAttempts: true,
        lockedUntil: true,
        employee: { select: { id: true, companyId: true } },
      },
    });

    if (admin) {
      // Test if the seeded password still works
      const testPassword = await bcrypt.compare('Admin@123', admin.passwordHash ?? '');
      checks.admin = {
        exists: true,
        role: admin.role,
        hasPasswordHash: !!admin.passwordHash,
        hashLength: admin.passwordHash?.length,
        hashPrefix: admin.passwordHash?.substring(0, 7),
        seedPasswordValid: testPassword,
        loginAttempts: admin.loginAttempts,
        lockedUntil: admin.lockedUntil,
        hasEmployee: !!admin.employee,
        companyId: admin.employee?.companyId,
      };
    } else {
      checks.admin = { exists: false };
    }
  } catch (e: any) {
    checks.admin = { error: e.message };
  }

  // 5. Summary diagnosis
  const env = checks.env as any;
  const dbCheck = checks.db as any;
  const adminCheck = checks.admin as any;

  const issues: string[] = [];
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) issues.push('CRITICAL: Neither AUTH_SECRET nor NEXTAUTH_SECRET is set — JWT signing will fail silently');
  if (!dbCheck.connected) issues.push('CRITICAL: Cannot connect to database');
  if (adminCheck && !adminCheck.exists) issues.push('Admin user does not exist — run prisma db seed');
  if (adminCheck && adminCheck.exists && !adminCheck.seedPasswordValid) issues.push('Admin password hash does not match Admin@123 — password was changed or seed used different value');
  if (adminCheck && adminCheck.lockedUntil) issues.push(`Admin account locked until ${adminCheck.lockedUntil}`);
  if (adminCheck && adminCheck.loginAttempts > 0) issues.push(`Admin has ${adminCheck.loginAttempts} failed login attempts`);
  if (!adminCheck?.hasEmployee) issues.push('Admin user has no linked employee record');
  if (issues.length === 0) issues.push('No obvious issues found — check Vercel Function logs for [auth] prefixed entries');

  checks.diagnosis = issues;

  return NextResponse.json(checks, { status: 200 });
}
