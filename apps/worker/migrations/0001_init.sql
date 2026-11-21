-- Better Auth tables (renamed + snake_case through the auth config)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE magic_links (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX magic_links_identifier ON magic_links(identifier);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  provider_account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  scope TEXT,
  password TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One account per user. digest_cursor: changes and failures after it go into the next morning email.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  time_zone TEXT,
  digest_cursor TEXT NOT NULL,
  last_digest_on TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE subscriptions (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('starter', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('no_subscription', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  next_billed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE paddle_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE owner_alerts (
  kind TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);

-- The row holds the latest state of a link; "paused" (over the plan limit) is derived at read time, never stored.
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  store_host TEXT NOT NULL,
  handle TEXT NOT NULL,
  variant_key TEXT NOT NULL DEFAULT '',
  title TEXT,
  variant_title TEXT,
  price_cents INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ok', 'failed')),
  fail_reason TEXT CHECK (fail_reason IN ('not_shopify', 'unavailable', 'blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_check_at TEXT NOT NULL,
  leased_until TEXT,
  last_checked_at TEXT,
  failed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, store_host, handle, variant_key)
);
CREATE INDEX links_due ON links(next_check_at);
CREATE INDEX links_account_created ON links(account_id, created_at);

-- Written on the first read and on every change only; previous_cents is NULL only for the first point.
CREATE TABLE price_points (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  previous_cents INTEGER,
  recorded_at TEXT NOT NULL
);
CREATE INDEX price_points_account_recorded ON price_points(account_id, recorded_at);
CREATE INDEX price_points_link ON price_points(link_id);

-- Abuse shield. Rate-limit hits for windows longer than the Workers binding allows (it only does 10 s / 60 s);
-- keys are SHA-256 hashes, never raw emails or IPs.
CREATE TABLE rate_limit_hits (
  key TEXT NOT NULL,
  hit_at TEXT NOT NULL
);
CREATE INDEX rate_limit_hits_key_at ON rate_limit_hits (key, hit_at);

-- Dev-only outbox for the log mailer (sign-in links and digests in local runs and tests)
CREATE TABLE dev_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
