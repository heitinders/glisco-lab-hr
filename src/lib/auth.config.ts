import type { NextAuthConfig } from 'next-auth';

// Edge-safe config — no Prisma, no bcrypt, no Node.js modules.
// Providers are defined in auth.ts only. This config handles
// session, pages, and callbacks for the Edge middleware.
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [], // Populated in auth.ts (full config) and middleware (empty is fine for JWT verification)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.employeeId = (user as any).employeeId;
        token.companyId = (user as any).companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).companyId = token.companyId;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password')
      ) {
        return true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
