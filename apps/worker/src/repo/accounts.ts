import type { Plan, SubscriptionStatus } from "@price-watch/contract";

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

export type AccountContext = {
  userId: string;
  accountId: string;
  email: string;
  timeZone: string | null;
  plan: Plan | null;
  subscription: SubscriptionStatus;
};
