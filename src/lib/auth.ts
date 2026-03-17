import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          console.log('[auth] authorize called with email:', credentials?.email);

          if (!credentials?.email || !credentials?.password) {
            console.log('[auth] missing credentials');
            return null;
          }

          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
            include: { employee: { select: { id: true, companyId: true } } },
          });

          console.log('[auth] user found:', !!user, 'hasPassword:', !!user?.passwordHash);

          if (!user?.passwordHash) return null;

          if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new Error('Account locked. Try again later.');
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          console.log('[auth] password valid:', isValid);

          if (!isValid) {
            const attempts = user.loginAttempts + 1;
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

          console.log('[auth] returning user:', result.id, result.email, result.role);
          return result;
        } catch (error) {
          console.error('[auth] authorize error:', error);
          throw error;
        }
      },
    }),
  ],
  debug: true,
});
