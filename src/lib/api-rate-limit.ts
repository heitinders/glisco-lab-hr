import { NextRequest, NextResponse } from 'next/server';
import {
  rateLimit,
  AUTH_RATE_LIMIT,
  API_RATE_LIMIT,
  AI_RATE_LIMIT,
} from './rate-limit';

/**
 * Check rate limit for an API request.
 * Returns a 429 Response if the limit is exceeded, or null if allowed.
 *
 * Usage in API routes:
 * ```ts
 * const rateLimited = checkApiRateLimit(req);
 * if (rateLimited) return rateLimited;
 * ```
 */
export function checkApiRateLimit(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;

  // Determine the key and config based on the route
  let key: string;
  let config;

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (pathname.startsWith('/api/auth')) {
    // Auth routes: rate limit by IP
    key = `auth:${ip}`;
    config = AUTH_RATE_LIMIT;
  } else if (pathname.startsWith('/api/ai')) {
    // AI routes: rate limit by user (from auth header/cookie) or IP
    key = `ai:${ip}`;
    config = AI_RATE_LIMIT;
  } else {
    // General API: rate limit by IP
    key = `api:${ip}`;
    config = API_RATE_LIMIT;
  }

  const result = rateLimit(key, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(
            Math.ceil((result.resetAt - Date.now()) / 1000),
          ),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}
