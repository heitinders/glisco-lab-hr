/**
 * In-memory rate limiter for API routes.
 * In production, swap the Map for Redis (ioredis) for multi-instance support.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  entry.count++;
  store.set(key, entry);

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

/** Auth endpoints: 5 requests per minute per IP */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSeconds: 60,
};

/** General API: 100 requests per minute per user */
export const API_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
};

/** AI endpoints: 10 requests per minute per user */
export const AI_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSeconds: 60,
};
