const HIT_RETENTION_MS = 24 * 60 * 60_000;

// Sliding window: records this hit only when fewer than `limit` hits for `key` are inside the window.
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
  // One guarded statement, so parallel requests cannot all read the same count and pass.
  const result = await db
    .prepare(
      `INSERT INTO rate_limit_hits (key, hit_at)
       SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM rate_limit_hits WHERE key = ?1 AND hit_at > ?3) < ?4`,
    )
    .bind(key, now.toISOString(), since, limit)
    .run();

  return result.meta.changes > 0;
}

export async function purgeOldRateLimitHits({ db, now }: { db: D1Database; now: Date }) {
  const result = await db
    .prepare("DELETE FROM rate_limit_hits WHERE hit_at < ?")
    .bind(new Date(now.getTime() - HIT_RETENTION_MS).toISOString())
    .run();
  return result.meta.changes;
}
