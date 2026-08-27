/**
 * Process-local sliding-window rate limiter. It is deliberately conservative
 * for the single-instance prototype; a multi-instance deployment should use a
 * shared store such as Redis while retaining the same endpoint buckets.
 */
const hits = new Map();
const MAX_KEYS = 10_000;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export function rateLimitPolicy(scope = "chat") {
  const upperScope = String(scope || "chat").replace(/[^a-z0-9]/gi, "_").toUpperCase();
  const defaultMax = scope === "chat" ? 30 : scope === "feedback" ? 20 : 10;
  return {
    windowMs: boundedInteger(
      process.env[`RATE_${upperScope}_WINDOW_MS`] || process.env.RATE_WINDOW_MS,
      10 * 60 * 1000,
      1_000,
      24 * 60 * 60 * 1000
    ),
    maxRequests: boundedInteger(
      process.env[`RATE_${upperScope}_MAX`] || process.env.RATE_MAX,
      defaultMax,
      1,
      10_000
    ),
  };
}

export function rateLimit(key, options = {}) {
  const scope = String(options.scope || "chat");
  const policy = rateLimitPolicy(scope);
  const windowMs = options.windowMs ?? policy.windowMs;
  const maxRequests = options.maxRequests ?? policy.maxRequests;
  const now = options.now ?? Date.now();
  const bucketKey = `${scope}:${String(key || "unknown")}`;
  const cutoff = now - windowMs;
  const recent = (hits.get(bucketKey) || []).filter((timestamp) => timestamp > cutoff);

  if (recent.length >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    hits.set(bucketKey, recent);
    return { allowed: false, retryAfter, limit: maxRequests, remaining: 0 };
  }

  recent.push(now);
  hits.set(bucketKey, recent);
  if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value);
  return {
    allowed: true,
    retryAfter: 0,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - recent.length),
  };
}

export function resetRateLimits() {
  hits.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const [bucketKey, timestamps] of hits) {
    const scope = bucketKey.split(":", 1)[0] || "chat";
    const cutoff = now - rateLimitPolicy(scope).windowMs;
    const recent = timestamps.filter((timestamp) => timestamp > cutoff);
    if (recent.length) hits.set(bucketKey, recent);
    else hits.delete(bucketKey);
  }
}, 10 * 60 * 1000).unref?.();
