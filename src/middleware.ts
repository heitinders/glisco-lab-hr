import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ['/login', '/api/auth', '/forgot-password', '/reset-password'];

export default auth((req) => {
  const session = req.auth;
  const pathname = req.nextUrl.pathname;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Unauthenticated user on a protected route → redirect to login
  if (!session && !isPublicRoute) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on login page → redirect to dashboard
  if (session && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
