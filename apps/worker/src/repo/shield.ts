const HIT_RETENTION_MS = 24 * 60 * 60_000;

// Sliding window: counts the hits for `key` inside the window and records this one only when it is allowed.
export async function consumeRateLimit({
  db,
  key,
  limit,
  windowMs,
  now,
}: {
  db: D1Database;
  key: string;
  limit: number;
  windowMs: number;
  now: Date;
}) {
  const since = new Date(now.getTime() - windowMs).toISOString();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM rate_limit_hits WHERE key = ? AND hit_at > ?")
    .bind(key, since)
    .first<{ n: number }>();

  if ((row?.n ?? 0) >= limit) {
    return false;
  }
  await db.prepare("INSERT INTO rate_limit_hits (key, hit_at) VALUES (?, ?)").bind(key, now.toISOString()).run();
  return true;
}

export async function purgeOldRateLimitHits({ db, now }: { db: D1Database; now: Date }) {
  const result = await db
    .prepare("DELETE FROM rate_limit_hits WHERE hit_at < ?")
    .bind(new Date(now.getTime() - HIT_RETENTION_MS).toISOString())
    .run();
  return result.meta.changes;
}
