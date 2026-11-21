import { type FailReason, LIVE_STATUSES, type LinkDto, type LinkStatus, PLANS } from "@price-watch/contract";

import { newId } from "../ids";
import type { ParsedLink } from "../links/parse";

export type NewLink = Extract<ParsedLink, { ok: true }>;
export type InsertOutcome = "added" | "duplicate" | "over_limit";

type LinkRow = {
  id: string;
  url: string;
  store_host: string;
  title: string | null;
  variant_title: string | null;
  price_cents: number | null;
  status: StoredStatus;
  fail_reason: FailReason | null;
  last_checked_at: string | null;
  created_at: string;
  position: number;
  previous_price_cents: number | null;
  changed_at: string | null;
};

type KeyRow = { store_host: string; handle: string; variant_key: string };

type StoredStatus = Exclude<LinkStatus, "paused">;

export type LeasedLink = {
  id: string;
  accountId: string;
  storeHost: string;
  handle: string;
  variantKey: string;
  priceCents: number | null;
  status: StoredStatus;
  failReason: FailReason | null;
  attempts: number;
  timeZone: string | null;
};

export type CheckOutcome = {
  link: LeasedLink;
  status: StoredStatus;
  failReason: FailReason | null;
  attempts: number;
  nextCheckAt: Date;
  product: { title: string; variantTitle: string | null; priceCents: number } | null;
};

type LeasedRow = {
  id: string;
  account_id: string;
  store_host: string;
  handle: string;
  variant_key: string;
  price_cents: number | null;
  status: StoredStatus;
  fail_reason: FailReason | null;
  attempts: number;
  time_zone: string | null;
};

// A new link is due on the very next run, even one whose clock is a little behind the paste.
const DUE_AT_ONCE = new Date(0).toISOString();

const PLAN_LINK_LIMITS = JSON.stringify(
  Object.fromEntries(
    Object.entries(PLANS).map(([plan, { linkLimit }]) => {
      return [plan, linkLimit];
    }),
  ),
);

// One batch, so the limit holds when two pastes race: D1 runs the statements one after another and
// every insert re-counts the account's links.
export async function insertLinks({
  db,
  accountId,
  links,
  limit,
  now,
}: {
  db: D1Database;
  accountId: string;
  links: NewLink[];
  limit: number;
  now: Date;
}) {
  const at = now.toISOString();
  const statements = links.map((link) => {
    return db
      .prepare(
        `INSERT OR IGNORE INTO links (id, account_id, url, store_host, handle, variant_key, status, next_check_at, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?9, ?7
         WHERE (SELECT COUNT(*) FROM links WHERE account_id = ?2) < ?8`,
      )
      .bind(newId(), accountId, link.url, link.host, link.handle, link.variantKey, at, limit, DUE_AT_ONCE);
  });
  const results = statements.length > 0 ? await db.batch(statements) : [];
  const stored = results.some((result) => result.meta.changes === 0)
    ? await listLinkKeys({ db, accountId })
    : new Set<string>();

  return links.map((link, index): InsertOutcome => {
    if (results[index].meta.changes > 0) {
      return "added";
    }
    return stored.has(toKey(link)) ? "duplicate" : "over_limit";
  });
}

export async function countLinks({ db, accountId }: { db: D1Database; accountId: string }) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM links WHERE account_id = ?")
    .bind(accountId)
    .first<{ n: number }>();

  return row?.n ?? 0;
}

// `paused` is derived from the plan limit on every read, never stored, so it can't fall out of sync with the plan.
// Without a live plan nothing is checked, so the links keep their last status instead (`limit` is null).
// The last change is the newest price point that has a previous price.
export async function listLinks({ db, accountId, limit }: { db: D1Database; accountId: string; limit: number | null }) {
  const { results } = await db
    .prepare(
      `WITH ranked AS (
         SELECT id, url, store_host, title, variant_title, price_cents, status, fail_reason, last_checked_at, created_at,
                ROW_NUMBER() OVER (ORDER BY created_at, rowid) AS position
         FROM links WHERE account_id = ?1
       ),
       changes AS (
         SELECT link_id, price_cents, previous_cents, recorded_at,
                ROW_NUMBER() OVER (PARTITION BY link_id ORDER BY recorded_at DESC) AS recency
         FROM price_points WHERE account_id = ?1 AND previous_cents IS NOT NULL
       )
       SELECT r.*, c.previous_cents AS previous_price_cents, c.recorded_at AS changed_at
       FROM ranked r LEFT JOIN changes c ON c.link_id = r.id AND c.recency = 1
       ORDER BY c.recorded_at IS NULL, c.recorded_at DESC, r.created_at DESC`,
    )
    .bind(accountId)
    .all<LinkRow>();

  return results.map((row) => toLinkDto({ row, limit }));
}

// Takes due links of live accounts, only the oldest ones up to the plan limit, and marks them leased in the same
// statement, so a run that overlaps this one skips them. Hosts take turns so one store can't fill the run.
export async function leaseDueLinks({
  db,
  now,
  leasedUntil,
  perRun,
  perHost,
}: {
  db: D1Database;
  now: Date;
  leasedUntil: Date;
  perRun: number;
  perHost: number;
}) {
  const { results } = await db
    .prepare(
      `WITH plan_limits AS (
         SELECT key AS plan, value AS link_limit FROM json_each(?1)
       ),
       in_plan AS (
         SELECT l.id, l.store_host, l.next_check_at, l.leased_until, l.created_at, p.link_limit,
                ROW_NUMBER() OVER (PARTITION BY l.account_id ORDER BY l.created_at, l.rowid) AS position
         FROM links l
         JOIN subscriptions s ON s.account_id = l.account_id
         JOIN plan_limits p ON p.plan = s.plan
         WHERE s.status IN (SELECT value FROM json_each(?2))
           AND l.account_id IN (SELECT account_id FROM links WHERE next_check_at <= ?3)
       ),
       due AS (
         SELECT id, next_check_at, created_at,
                ROW_NUMBER() OVER (PARTITION BY store_host ORDER BY next_check_at, created_at, id) AS host_turn
         FROM in_plan
         WHERE position <= link_limit AND next_check_at <= ?3 AND (leased_until IS NULL OR leased_until <= ?3)
       )
       UPDATE links SET leased_until = ?4
       WHERE id IN (SELECT id FROM due WHERE host_turn <= ?5 ORDER BY host_turn, next_check_at, created_at, id LIMIT ?6)
       RETURNING id, account_id, store_host, handle, variant_key, price_cents, status, fail_reason, attempts,
                 (SELECT time_zone FROM accounts WHERE accounts.id = links.account_id) AS time_zone`,
    )
    .bind(
      PLAN_LINK_LIMITS,
      JSON.stringify(LIVE_STATUSES),
      now.toISOString(),
      leasedUntil.toISOString(),
      perHost,
      perRun,
    )
    .all<LeasedRow>();

  return results.map((row) => {
    const link: LeasedLink = {
      id: row.id,
      accountId: row.account_id,
      storeHost: row.store_host,
      handle: row.handle,
      variantKey: row.variant_key,
      priceCents: row.price_cents,
      status: row.status,
      failReason: row.fail_reason,
      attempts: row.attempts,
      timeZone: row.time_zone,
    };
    return link;
  });
}

// One batch for the whole run. A price point is written on the first read and on a change only;
// `failed_at` keeps the moment the link first failed, so the digest reports a failure once.
export async function saveCheckOutcomes({
  db,
  outcomes,
  now,
}: {
  db: D1Database;
  outcomes: CheckOutcome[];
  now: Date;
}) {
  const at = now.toISOString();
  const statements = outcomes.flatMap((outcome) => {
    const { link, product } = outcome;
    const update = db
      .prepare(
        `UPDATE links SET
           title = COALESCE(?2, title),
           variant_title = CASE WHEN ?2 IS NULL THEN variant_title ELSE ?3 END,
           price_cents = COALESCE(?4, price_cents),
           status = ?5,
           fail_reason = ?6,
           failed_at = CASE WHEN ?5 <> 'failed' THEN NULL WHEN status = 'failed' THEN failed_at ELSE ?7 END,
           attempts = ?8,
           last_checked_at = ?7,
           next_check_at = ?9,
           leased_until = NULL
         WHERE id = ?1`,
      )
      .bind(
        link.id,
        product?.title ?? null,
        product?.variantTitle ?? null,
        product?.priceCents ?? null,
        outcome.status,
        outcome.failReason,
        at,
        outcome.attempts,
        outcome.nextCheckAt.toISOString(),
      );

    if (!product || product.priceCents === link.priceCents) {
      return [update];
    }
    const pricePoint = db
      .prepare(
        `INSERT INTO price_points (id, link_id, account_id, price_cents, previous_cents, recorded_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM links WHERE id = ?2)`,
      )
      .bind(newId(), link.id, link.accountId, product.priceCents, link.priceCents, at);
    return [pricePoint, update];
  });

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

export async function deleteLink({ db, accountId, linkId }: { db: D1Database; accountId: string; linkId: string }) {
  const [, link] = await db.batch([
    db.prepare("DELETE FROM price_points WHERE link_id = ? AND account_id = ?").bind(linkId, accountId),
    db.prepare("DELETE FROM links WHERE id = ? AND account_id = ?").bind(linkId, accountId),
  ]);

  return link.meta.changes > 0;
}

async function listLinkKeys({ db, accountId }: { db: D1Database; accountId: string }) {
  const { results } = await db
    .prepare("SELECT store_host, handle, variant_key FROM links WHERE account_id = ?")
    .bind(accountId)
    .all<KeyRow>();

  return new Set(
    results.map((row) => toKey({ host: row.store_host, handle: row.handle, variantKey: row.variant_key })),
  );
}

function toKey({ host, handle, variantKey }: { host: string; handle: string; variantKey: string }) {
  return JSON.stringify([host, handle, variantKey]);
}

function toLinkDto({ row, limit }: { row: LinkRow; limit: number | null }) {
  const link: LinkDto = {
    id: row.id,
    url: row.url,
    storeHost: row.store_host,
    title: row.title,
    variantTitle: row.variant_title,
    priceCents: row.price_cents,
    previousPriceCents: row.previous_price_cents,
    changedAt: row.changed_at,
    status: limit !== null && row.position > limit ? "paused" : row.status,
    failReason: row.fail_reason,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
  };
  return link;
}
