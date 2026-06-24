/**
 * Tiny in-memory sliding-window rate limiter to curb overuse / abuse.
 * Good enough for a single-instance deployment; swap for Redis if you scale out.
 */
const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 10 * 60 * 1000); // 10 min
const MAX_REQUESTS = Number(process.env.RATE_MAX || 30); // per window per client

const hits = new Map(); // key -> number[] (timestamps)

export function rateLimit(key) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) || []).filter((t) => t > cutoff);

  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

// Periodically drop empty/old entries so the map doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, times] of hits) {
    const recent = times.filter((t) => t > cutoff);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
  }
}, WINDOW_MS).unref?.();
