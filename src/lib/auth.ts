import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db) as any,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: { employee: { select: { id: true, companyId: true } } },
        });

        if (!user?.passwordHash) return null;

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('Account locked. Try again later.');
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

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

        // Reset login attempts on success
        await db.user.update({
          where: { id: user.id },
          data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          employeeId: user.employee?.id,
          companyId: user.employee?.companyId,
        };
      },
    }),
  ],
});
