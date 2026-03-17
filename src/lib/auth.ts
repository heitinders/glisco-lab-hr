import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { authConfig } from './auth.config';

// ── Environment diagnostics (runs once on cold start) ───────────────
console.log('[auth][env] AUTH_SECRET set:', !!process.env.AUTH_SECRET);
console.log('[auth][env] NEXTAUTH_SECRET set:', !!process.env.NEXTAUTH_SECRET);
console.log('[auth][env] AUTH_URL:', process.env.AUTH_URL ?? 'NOT SET');
console.log('[auth][env] NEXTAUTH_URL:', process.env.NEXTAUTH_URL ?? 'NOT SET');
console.log('[auth][env] NODE_ENV:', process.env.NODE_ENV);
console.log('[auth][env] VERCEL_URL:', process.env.VERCEL_URL ?? 'NOT SET');
console.log('[auth][env] DATABASE_URL set:', !!process.env.DATABASE_URL);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('━━━━━━━━━━ [auth] AUTHORIZE START ━━━━━━━━━━');
        console.log('[auth] email:', credentials?.email);
        console.log('[auth] password provided:', !!credentials?.password);

        try {
          if (!credentials?.email || !credentials?.password) {
            console.log('[auth] ✗ REJECTED: missing email or password');
            return null;
          }

          // DB lookup
          console.log('[auth] querying DB for user...');
          const t0 = Date.now();
          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
            include: { employee: { select: { id: true, companyId: true } } },
          });
          console.log(`[auth] DB query took ${Date.now() - t0}ms`);
          console.log('[auth] user found:', !!user);
          console.log('[auth] user id:', user?.id);
          console.log('[auth] user role:', user?.role);
          console.log('[auth] has passwordHash:', !!user?.passwordHash);
          console.log('[auth] has employee:', !!user?.employee);

          if (!user?.passwordHash) {
            console.log('[auth] ✗ REJECTED: no user or no passwordHash');
            return null;
          }

          // Account lock check
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            console.log('[auth] ✗ REJECTED: account locked until', user.lockedUntil);
            throw new Error('Account locked. Try again later.');
          }

          // Password verification
          console.log('[auth] comparing password...');
          const t1 = Date.now();
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          console.log(`[auth] bcrypt compare took ${Date.now() - t1}ms`);
          console.log('[auth] password valid:', isValid);

          if (!isValid) {
            const attempts = user.loginAttempts + 1;
            console.log(`[auth] ✗ REJECTED: wrong password (attempt ${attempts})`);
            await db.user.update({
              where: { id: user.id },
              data: {
                loginAttempts: attempts,
                lockedUntil:
                  attempts >= 5
                    ? new Date(Date.now() + 15 * 60 * 1000)
                    : null,
              },
            });
            return null;
          }

          // Success — reset attempts
          await db.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
          });

          const result = {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            employeeId: user.employee?.id,
            companyId: user.employee?.companyId,
          };

          console.log('[auth] ✓ SUCCESS: returning user', JSON.stringify(result));
          console.log('━━━━━━━━━━ [auth] AUTHORIZE END ━━━━━━━━━━');
          return result;
        } catch (error) {
          console.error('[auth] ✗ EXCEPTION in authorize:', error);
          console.error('[auth] error stack:', (error as Error).stack);
          console.log('━━━━━━━━━━ [auth] AUTHORIZE END (error) ━━━━━━━━━━');
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      console.log('[auth][jwt] trigger:', trigger, 'hasUser:', !!user, 'tokenSub:', token.sub);
      if (user) {
        token.role = (user as any).role;
        token.employeeId = (user as any).employeeId;
        token.companyId = (user as any).companyId;
        console.log('[auth][jwt] enriched token with role:', token.role);
      }
      return token;
    },
    async session({ session, token }) {
      console.log('[auth][session] tokenSub:', token.sub, 'role:', token.role);
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).companyId = token.companyId;
      }
      return session;
    },
  },
  debug: true,
});
