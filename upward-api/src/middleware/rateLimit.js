import { ApiError } from '../utils/httpError.js';

const buckets = new Map();

let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit({ windowMs = 60_000, max = 100, name = 'general' }) {
  return (req, res, next) => {
    const now = Date.now();
    sweep(now);
    const key = `${name}:${req.ip}:${req.user?.id ?? 'anon'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
    }
    next();
  };
}
