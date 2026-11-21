import type { Plan, SubscriptionStatus } from "@price-watch/contract";

import { HttpError, json, readJson, readString, route, type Route } from "../http";
import { newId } from "../ids";
import { createAccount, getAccountByUserId, setSubscription } from "../repo/accounts";
import type { PublicContext } from "./context";

const EMAIL_MAX_LENGTH = 254;
const OUTBOX_LIMIT = 20;

// Dev-only: billing is driven by Paddle, so local runs and tests create accounts here.
export const devRoutes: Route<PublicContext>[] = [
  route("POST", "/dev/accounts", async ({ deps, request }) => {
    const data = await readJson(request);
    const email = readString({ data, key: "email", maxLength: EMAIL_MAX_LENGTH }).trim().toLowerCase();
    const plan = readPlan(data.plan);
    const status = readStatus({ value: data.status, plan });
    const now = deps.now();

    if (!email.includes("@")) {
      throw new HttpError(400, "invalid_field", '"email" must be an email address');
    }

    const userId = await ensureUser({ db: deps.db, email, now });
    const existing = await getAccountByUserId({ db: deps.db, userId });
    const accountId = existing?.accountId ?? (await createAccount({ db: deps.db, userId, email, plan, status, now }));

    if (existing) {
      await setSubscription({ db: deps.db, accountId, plan, status, now });
    }
    return json({ userId, accountId }, 201);
  }),

  route("GET", "/dev/outbox", async ({ deps, request }) => {
    const to = new URL(request.url).searchParams.get("to") ?? "";
    const { results } = await deps.db
      .prepare(
        'SELECT to_address AS "to", subject, body, created_at AS createdAt FROM dev_outbox WHERE to_address = ? ORDER BY id DESC LIMIT ?',
      )
      .bind(to.toLowerCase(), OUTBOX_LIMIT)
      .all();
    return json(results);
  }),
];

function readPlan(value: unknown): Plan | null {
  return value === "starter" || value === "pro" ? value : null;
}

const STATUSES: SubscriptionStatus[] = ["no_subscription", "trialing", "active", "past_due", "paused", "canceled"];

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return STATUSES.some((status) => {
    return status === value;
  });
}

function readStatus({ value, plan }: { value: unknown; plan: Plan | null }): SubscriptionStatus {
  if (isSubscriptionStatus(value)) {
    return value;
  }
  return plan ? "active" : "no_subscription";
}

async function ensureUser({ db, email, now }: { db: D1Database; email: string; now: Date }) {
  const at = now.toISOString();
  const row = await db
    .prepare(
      `INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES (?, '', ?, 1, ?, ?)
       ON CONFLICT (email) DO UPDATE SET updated_at = excluded.updated_at
       RETURNING id`,
    )
    .bind(newId(), email, at, at)
    .first<{ id: string }>();

  if (!row) {
    throw new Error("Could not create the user");
  }
  return row.id;
}
