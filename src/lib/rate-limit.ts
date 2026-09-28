type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sliding window rate limit. Returns true if allowed, false if exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

/** True when the bucket is already exhausted; does not consume a slot. */
export function isRateLimited(key: string, limit: number): boolean {
  const entry = buckets.get(key);
  return Boolean(entry && Date.now() < entry.resetAt && entry.count >= limit);
}

/**
 * nginx sets X-Real-IP to $remote_addr and *appends* to X-Forwarded-For, so only X-Real-IP
 * or the last X-Forwarded-For hop is trustworthy; the first hop is client-controlled.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) || "unknown";
}
