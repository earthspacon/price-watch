import { isLive, PLANS, type Plan, type SubscriptionStatus } from "@price-watch/contract";

import { newId } from "../ids";

export async function createAccount({
  db,
  userId,
  email,
  plan = null,
  status,
  now,
}: {
  db: D1Database;
  userId: string;
  email: string;
  plan?: Plan | null;
  status: SubscriptionStatus;
  now: Date;
}) {
  const accountId = newId();
  const at = now.toISOString();

  await db.batch([
    db
      .prepare("INSERT INTO accounts (id, user_id, email, digest_cursor, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(accountId, userId, email, at, at),
    db
      .prepare("INSERT INTO subscriptions (account_id, plan, status, updated_at) VALUES (?, ?, ?, ?)")
      .bind(accountId, plan, status, at),
  ]);
  return accountId;
}

export async function setSubscription({
  db,
  accountId,
  plan,
  status,
  now,
}: {
  db: D1Database;
  accountId: string;
  plan: Plan | null;
  status: SubscriptionStatus;
  now: Date;
}) {
  await db
    .prepare("UPDATE subscriptions SET plan = ?, status = ?, updated_at = ? WHERE account_id = ?")
    .bind(plan, status, now.toISOString(), accountId)
    .run();
}

export async function getAccountByUserId({ db, userId }: { db: D1Database; userId: string }) {
  const row = await db
    .prepare(
      `SELECT a.id AS account_id, a.email, a.time_zone, s.plan, s.status
       FROM accounts a JOIN subscriptions s ON s.account_id = a.id
       WHERE a.user_id = ?`,
    )
    .bind(userId)
    .first<{
      account_id: string;
      email: string;
      time_zone: string | null;
      plan: Plan | null;
      status: SubscriptionStatus;
    }>();

  if (!row) {
    return null;
  }
  const account: AccountContext = {
    userId,
    accountId: row.account_id,
    email: row.email,
    timeZone: row.time_zone,
    plan: row.plan,
    subscription: row.status,
  };
  return account;
}

export type BillingRow = {
  plan: Plan | null;
  status: SubscriptionStatus;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  next_billed_at: string | null;
};

export async function getBillingRow({ db, accountId }: { db: D1Database; accountId: string }) {
  return db
    .prepare(
      `SELECT plan, status, paddle_subscription_id, paddle_customer_id, next_billed_at
       FROM subscriptions WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<BillingRow>();
}

// Paddle echoes the account id from checkout custom data; the subscription id covers events that lack it.
export async function findAccountIdForPaddle({
  db,
  accountId,
  paddleSubscriptionId,
}: {
  db: D1Database;
  accountId: string | null;
  paddleSubscriptionId: string | null;
}) {
  const row = await db
    .prepare("SELECT account_id FROM subscriptions WHERE account_id = ?1 OR paddle_subscription_id = ?2 LIMIT 1")
    .bind(accountId, paddleSubscriptionId)
    .first<{ account_id: string }>();

  return row?.account_id ?? null;
}

export async function saveSubscription({
  db,
  accountId,
  update,
  now,
}: {
  db: D1Database;
  accountId: string;
  update: {
    plan: Plan | null;
    status: SubscriptionStatus;
    paddleSubscriptionId: string;
    paddleCustomerId: string | null;
    nextBilledAt: string | null;
  };
  now: Date;
}) {
  await db
    .prepare(
      `UPDATE subscriptions
       SET plan = ?, status = ?, paddle_subscription_id = ?, paddle_customer_id = ?, next_billed_at = ?, updated_at = ?
       WHERE account_id = ?`,
    )
    .bind(
      update.plan,
      update.status,
      update.paddleSubscriptionId,
      update.paddleCustomerId,
      update.nextBilledAt,
      now.toISOString(),
      accountId,
    )
    .run();
}

// False when Paddle already delivered this event id.
export async function recordPaddleEvent({
  db,
  eventId,
  eventType,
  now,
}: {
  db: D1Database;
  eventId: string;
  eventType: string;
  now: Date;
}) {
  const result = await db
    .prepare("INSERT OR IGNORE INTO paddle_events (event_id, type, received_at) VALUES (?, ?, ?)")
    .bind(eventId, eventType, now.toISOString())
    .run();

  return result.meta.changes > 0;
}

// True when this kind has not been sent since `since`; the slot is taken in the same statement.
export async function claimOwnerAlert({
  db,
  kind,
  now,
  since,
}: {
  db: D1Database;
  kind: string;
  now: Date;
  since: Date;
}) {
  const row = await db
    .prepare(
      `INSERT INTO owner_alerts (kind, sent_at) VALUES (?1, ?2)
       ON CONFLICT (kind) DO UPDATE SET sent_at = excluded.sent_at WHERE owner_alerts.sent_at <= ?3
       RETURNING kind`,
    )
    .bind(kind, now.toISOString(), since.toISOString())
    .first<{ kind: string }>();

  return row !== null;
}

export type AccountContext = {
  userId: string;
  accountId: string;
  email: string;
  timeZone: string | null;
  plan: Plan | null;
  subscription: SubscriptionStatus;
};

// Zero without a live plan: nothing is tracked then, and every stored link reads as paused.
export function getLinkLimit({ account }: { account: AccountContext }) {
  return account.plan && isLive(account.subscription) ? PLANS[account.plan].linkLimit : 0;
}
