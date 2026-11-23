-- One paid plan replaces Starter and Pro. SQLite can't alter a CHECK, so the table is rebuilt.
-- Nothing references subscriptions, and every old plan maps to the single one.
CREATE TABLE subscriptions_new (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('paid')),
  status TEXT NOT NULL CHECK (status IN ('no_subscription', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  next_billed_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO subscriptions_new (account_id, plan, status, paddle_subscription_id, paddle_customer_id, next_billed_at, updated_at)
SELECT account_id, CASE WHEN plan IS NULL THEN NULL ELSE 'paid' END, status, paddle_subscription_id, paddle_customer_id, next_billed_at, updated_at
FROM subscriptions;

DROP TABLE subscriptions;

ALTER TABLE subscriptions_new RENAME TO subscriptions;
