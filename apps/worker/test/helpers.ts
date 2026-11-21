import type { AddLinksResult, LinkDto, Plan, SubscriptionStatus } from "@price-watch/contract";
import { env, SELF } from "cloudflare:test";
import { expect } from "vitest";

import { BASE } from "./session";

export const db = env.DB;

const MS_PER_MINUTE = 60_000;

export function uniqueEmail({ prefix }: { prefix: string }) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@shop.example`;
}

export function productUrl({ host, handle, variantId }: { host: string; handle: string; variantId?: number }) {
  const query = variantId === undefined ? "" : `?variant=${variantId}`;
  return `https://${host}/products/${handle}${query}`;
}

export async function apiFetch({
  cookie,
  path,
  method = "GET",
  body,
}: {
  cookie?: string;
  path: string;
  method?: string;
  body?: unknown;
}) {
  const headers = new Headers({ origin: BASE });
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return SELF.fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}

export async function postLinks({ cookie, text }: { cookie: string; text: string }) {
  return apiFetch({ cookie, path: "/api/links", method: "POST", body: { text } });
}

export async function addLinks({ cookie, urls }: { cookie: string; urls: string[] }) {
  const response = await postLinks({ cookie, text: urls.join("\n") });
  expect(response.status, "POST /api/links").toBe(200);
  return response.json<AddLinksResult>();
}

export async function readLinks({ cookie }: { cookie: string }) {
  const response = await apiFetch({ cookie, path: "/api/links" });
  expect(response.status, "GET /api/links").toBe(200);
  return response.json<LinkDto[]>();
}

// Dev routes: the same check and digest runs the crons start, at an explicit clock.
export async function runChecks({ now }: { now: string }) {
  const response = await apiFetch({ path: "/dev/run-checks", method: "POST", body: { now } });
  expect(response.ok, `POST /dev/run-checks answered ${response.status}`).toBe(true);
}

export async function runDigests({ now }: { now: string }) {
  const response = await apiFetch({ path: "/dev/run-digests", method: "POST", body: { now } });
  expect(response.ok, `POST /dev/run-digests answered ${response.status}`).toBe(true);
}

export function minutesAfter({ time, minutes }: { time: string; minutes: number }) {
  return new Date(Date.parse(time) + minutes * MS_PER_MINUTE).toISOString();
}

// Stands in for a Paddle webhook: plan changes are covered by the billing tests.
export async function updateSubscription({
  accountId,
  plan,
  status,
}: {
  accountId: string;
  plan: Plan;
  status: SubscriptionStatus;
}) {
  await db
    .prepare("UPDATE subscriptions SET plan = ?, status = ? WHERE account_id = ?")
    .bind(plan, status, accountId)
    .run();
}

export async function readPricePoints({ accountId }: { accountId: string }) {
  const { results } = await db
    .prepare(
      "SELECT price_cents AS priceCents, previous_cents AS previousCents, recorded_at AS recordedAt FROM price_points WHERE account_id = ? ORDER BY recorded_at",
    )
    .bind(accountId)
    .all<{ priceCents: number; previousCents: number | null; recordedAt: string }>();
  return results;
}

export async function countRows({ sql, binds }: { sql: string; binds: unknown[] }) {
  const row = await db
    .prepare(sql)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countOutbox({ to }: { to: string }) {
  return countRows({ sql: "SELECT COUNT(*) AS n FROM dev_outbox WHERE to_address = ?", binds: [to] });
}

export async function findLinkId({ accountId, host, handle }: { accountId: string; host: string; handle: string }) {
  const row = await db
    .prepare("SELECT id FROM links WHERE account_id = ? AND store_host = ? AND handle = ?")
    .bind(accountId, host, handle)
    .first<{ id: string }>();
  expect(row, `a stored link for ${host}/${handle}`).not.toBeNull();
  return row?.id ?? "";
}

// Stands in for the checker: a successful check of a link, with one price point per price in `history` (oldest first).
export async function recordCheckedPrices({
  linkId,
  accountId,
  title,
  variantTitle,
  history,
}: {
  linkId: string;
  accountId: string;
  title: string;
  variantTitle: string | null;
  history: Array<{ priceCents: number; recordedAt: string }>;
}) {
  const latest = history.at(-1);
  const statements = history.map((point, index) => {
    return db
      .prepare(
        "INSERT INTO price_points (id, link_id, account_id, price_cents, previous_cents, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        linkId,
        accountId,
        point.priceCents,
        index === 0 ? null : history[index - 1].priceCents,
        point.recordedAt,
      );
  });
  statements.push(
    db
      .prepare(
        "UPDATE links SET status = 'ok', title = ?, variant_title = ?, price_cents = ?, last_checked_at = ? WHERE id = ?",
      )
      .bind(title, variantTitle, latest?.priceCents ?? null, latest?.recordedAt ?? null, linkId),
  );
  await db.batch(statements);
}
