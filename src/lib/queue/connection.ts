import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisConnection(): Redis {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('REDIS_URL not set — queue jobs will fail');
    // Return a dummy connection that will fail on use (dev without Redis)
    redis = new Redis({ lazyConnect: true, maxRetriesPerRequest: 0 });
    return redis;
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // Stop retrying after 5 attempts
      return Math.min(times * 200, 3000);
    },
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  return redis;
}
