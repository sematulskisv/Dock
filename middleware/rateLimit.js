'use strict';

// Paprastas in-memory greicio ribotuvas (be priklausomybiu).
// Pakanka vienam Node procesui; uz kelis procesus reiketu Redis.

const buckets = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, key = null } = {}) {
  return function limiter(req, res, next) {
    const id = key
      ? key(req)
      : (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
        || req.socket?.remoteAddress
        || 'unknown';

    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: 'rate_limited', retryAfter: retry });
    }
    next();
  };
}

// Retkarciais issivalom, kad Map neaugtu be galo.
setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}, 10 * 60 * 1000).unref?.();

module.exports = { rateLimit };
