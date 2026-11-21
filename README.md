# PriceDawn

PriceDawn tracks your competitors' Shopify prices. Paste the product links you watch by hand, and every morning at 7:00 in your time zone you get one email that says which products changed price, from what to what and by how much. Each link is checked once a day through the store's public product data. If a product disappears, a store blocks the check or nothing changed, the email says so — it never invents a price change.

Two plans: Starter, $19 a month for 100 links, and Pro, $49 a month for 1,000. Paid through Paddle. Every plan includes the full price history as a CSV.

## Layout

| Path                | What                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/worker`       | Cloudflare Worker on D1: JSON API, email and Google sign-in, Paddle webhooks, daily link checks, the morning digest and the CSV export          |
| `apps/web`          | The React SPA for the signed-in app plus the public pages: landing, pricing, the Prisync comparison, the Shopify guide, terms, privacy, refunds |
| `packages/contract` | Types, plans and security headers shared by both apps                                                                                           |

## Run it locally

You need Node 24 and pnpm 10. No Cloudflare account is needed.

```sh
pnpm install
cd apps/worker
cp .dev.vars.example .dev.vars   # DEV_ROUTES=1 and a local auth secret
pnpm db:migrate                  # applies migrations/ to the local D1
pnpm dev                         # wrangler dev on http://localhost:8787
```

With `DEV_ROUTES=1` the app talks to a local outbox and a fake store instead of Resend and Shopify:

- Sign-in links go to the `dev_outbox` table. Read them with `GET /dev/outbox?to=<email>`.
- `POST /dev/accounts {"email": "...", "plan": "starter"}` creates an account without Paddle. Add `"status": "active"` to skip the plan step.
- `POST /dev/run-checks {"now": "2026-11-21T01:05:00Z"}` runs the every-minute check cron once, at the clock you pass.
- `POST /dev/run-digests {"now": "2026-11-21T07:05:00Z"}` runs the hourly digest cron once.
- Set `DEV_STORE_ORIGIN=http://localhost:9000` and the checker fetches `http://localhost:9000/<store host>/products/<handle>.json` instead of the real store. Any small HTTP server that answers that path with Shopify's product JSON works. The e2e suite starts one for you (`apps/web/e2e/fake-store.ts`) and can swap a product's price between checks.

## Tests

```sh
pnpm -r test                              # vitest; the worker suites run inside workerd with a real local D1
pnpm -r typecheck
pnpm --filter @price-watch/web test:e2e   # end-to-end tests in a real browser against wrangler dev and the fake store
pnpm --filter @price-watch/web shots      # page captures and a console-error check
```

Every test uses a fixed clock through the dev routes, so a "day" is a `POST /dev/run-checks` call and a "morning" is a `POST /dev/run-digests` call. No real Shopify, Resend or Paddle call is made: the fake store answers price checks and the Paddle webhook payloads are signed locally.

Deploying once the accounts exist: [`DEPLOY.md`](DEPLOY.md).

## How the daily check works

Every link has a `next_check_at`. A new link is due at once; after each check the next one is due at the next 01:00 in the account's time zone. The every-minute cron picks up to 20 due links from active accounts (at most 3 per store host), leases them for 10 minutes so two runs cannot fetch the same link, and writes all results back in one batch.

A check is one `GET https://<host>/products/<handle>.json` with a 10-second timeout and an honest `PriceDawn/1.0` user agent. The link row holds the latest price; a `price_points` row is written on the first read and whenever the price changes, never for an unchanged day. That keeps a thousand links from writing a thousand identical rows every morning.

Transient failures (429, 403, 5xx, network errors, timeouts) retry after 15 minutes, then 60; the third failure marks the link `blocked`. A product that is gone is `unavailable`, a page that is not Shopify product JSON is `not_shopify`. None of these touch the stored price.

On the Free plan one every-minute cron does at most 20 checks a minute, about 28,300 a day (the :00 tick runs the hourly jobs instead). `DEPLOY.md` covers when to move to Workers Paid.

## How the digest works

The hourly job (the :00 tick of the same trigger) wakes each account whose local clock has reached 07:00 and whose local day is newer than the last digest. It reads the price points with a previous price and the links that failed since the last digest, and sends one plain-text email grouped by store. On a quiet day it sends nothing — Resend Free allows 100 emails a day, and a quiet morning should not spend one.

Either way it records the local date and moves the digest cursor, so the next morning starts from a clean slate. A send that fails (provider down or over quota) leaves the account unmarked, and the next hourly run retries it. The digest footer links back to `<APP_URL>/app`.
