# Deploying PriceDawn

Run these in order once the Cloudflare, Paddle, Resend and Google accounts exist. Every command runs from `apps/worker` unless it says otherwise. Production config is the `[env.production]` block in `apps/worker/wrangler.toml`; the app runs on the subdomain `pricedawn.spacesonlabs.com` of the existing `spacesonlabs.com` zone.

Names used below:

| Name          | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| App and pages | `https://pricedawn.spacesonlabs.com`                               |
| Outbound mail | `pricedawn@mail.spacesonlabs.com` (sign-in links, digests, alerts) |
| Webhook       | `https://pricedawn.spacesonlabs.com/paddle/webhook`                |

## 0. Before you start

1. Fill `SELLER_LEGAL_NAME` in `apps/web/src/site/config.ts` (`CONTACT_EMAIL` is already `pricedawn@spacesonlabs.com`). Every public page reads both; Paddle's domain review wants the legal name in the terms.
2. `pnpm install` at the repo root, then `pnpm -r test` and `pnpm -r typecheck` must be green.

## 1. Cloudflare: domain and Worker

1. Add the custom domain `pricedawn.spacesonlabs.com` on the existing `spacesonlabs.com` zone (the zone is already Active in Cloudflare; the `routes` entry in `wrangler.toml` creates it on deploy).
2. Log in the CLI: `pnpm exec wrangler login`.
3. The Worker fits the Free plan at launch. Free allows 100,000 requests a day and 5 cron triggers per account. The every-minute check cron is the limit that matters: with up to 20 checks a minute (the :00 tick runs the hourly jobs instead) it can do about 28,300 checks a day. Buy **Workers Paid** ($5/mo) before that becomes tight — a few hundred active Starter accounts, or one Pro account tracking a thousand links — and whenever the Workers dashboard shows `Exceeded CPU` for the check cron. Paid also removes the 10 ms CPU ceiling per request.
4. Cron triggers are account-wide, 5 on Free. PriceDawn uses one every-minute trigger: the checks run on every tick except :00, the digests and the rate-limit purge on the :00 tick. InboxSieve and MonthMemo use one each, so the studio uses 3 of 5.

## 2. D1

1. `pnpm exec wrangler d1 create price-watch`
2. Copy the printed `database_id` into `[[env.production.d1_databases]]` in `wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).
3. `pnpm exec wrangler d1 migrations apply price-watch --remote --env production` (applies `0001_init.sql`).

## 3. Resend (outbound mail)

1. Resend → Domains → Add `mail.spacesonlabs.com`.
2. Add the DNS records Resend shows (DKIM `TXT`, the SPF `MX` + `TXT` on the `send` subdomain, optional DMARC `TXT`) in Cloudflare DNS. Set them to **DNS only** (grey cloud). Wait for "Verified".
3. Resend → API Keys → create a key with "Sending access" for that domain. Keep it for step 7.
4. The Free plan sends 100 emails a day. PriceDawn sends one digest per account per day, and nothing on a quiet day, so 100 is enough for the first hundred accounts. Upgrade to Resend Pro ($20/mo, 50,000 emails) before a hundred active accounts, or before any launch mail beyond digests. Failed sends are not lost: the account stays unmarked and the next hourly run retries.

## 4. Paddle (live account, after the domain review passes)

1. Checkout → Website approval: submit `https://pricedawn.spacesonlabs.com`. The landing, pricing, terms, privacy and refund pages must be live (do steps 8–9 first with sandbox values if the review needs a live site).
2. Catalog → Products: create **PriceDawn Starter** and **PriceDawn Pro**, each with one monthly price in USD: **Starter $19/mo** and **Pro $49/mo**. Add **no** Paddle trial period and no yearly prices. Copy the two `pri_…` ids into `PADDLE_PRICE_STARTER` and `PADDLE_PRICE_PRO` in `[env.production.vars]`.
3. Developer tools → Authentication → client-side token: copy it into `PADDLE_CLIENT_TOKEN`.
4. Developer tools → Authentication → API key with write access to customer portal sessions and subscriptions. Keep it for step 7.
5. Developer tools → Notifications → New destination:
   - URL: `https://pricedawn.spacesonlabs.com/paddle/webhook`
   - Events: `subscription.created`, `subscription.activated`, `subscription.trialing`, `subscription.updated`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`, `transaction.payment_failed`
   - Copy the destination's secret key for step 7.
6. Checkout → Checkout settings: set the default payment link to `https://pricedawn.spacesonlabs.com/app/billing`.

For a sandbox dry run first, use sandbox values and set `PADDLE_ENV = "sandbox"`.

## 5. Cloudflare Turnstile (bot check on sign-in)

1. Cloudflare → Turnstile → Add widget: name `PriceDawn sign-in`, hostname `pricedawn.spacesonlabs.com`, mode **Managed**.
2. Copy the **site key**: it is baked into the SPA at build time as `VITE_TURNSTILE_SITE_KEY` (step 8). Without it the build falls back to Cloudflare's test key and every real sign-in fails, loudly.
3. Copy the **secret key** for step 7 (`TURNSTILE_SECRET_KEY`).

## 6. Google sign-in ("Continue with Google")

Optional, but recommended: most people sign in with Google now. Without these two secrets the button is hidden and email links work as before.

1. Google Cloud Console (console.cloud.google.com) → create a project `PriceDawn`.
2. APIs & Services → OAuth consent screen (Google Auth Platform → Branding/Audience):
   - User type **External**, app name `PriceDawn`, support email and developer contact = your address, app domain `https://pricedawn.spacesonlabs.com`, privacy policy `https://pricedawn.spacesonlabs.com/privacy`, terms `https://pricedawn.spacesonlabs.com/terms`.
   - Data access / scopes: only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. These are non-sensitive, so no Google verification review is needed.
   - Publishing status: **In production** (in "Testing" only listed test users can sign in).
3. APIs & Services → Credentials → Create credentials → OAuth client ID:
   - Application type **Web application**, name `PriceDawn web`.
   - Authorized JavaScript origins: `https://pricedawn.spacesonlabs.com`.
   - Authorized redirect URIs: `https://pricedawn.spacesonlabs.com/api/auth/callback/google` (exactly this).
4. Copy the client ID and client secret into the two secrets in step 7 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Both must be set, or Google stays off.

Someone who signed in by email link and later uses Google with the same address gets the same account.

## 7. Worker configuration

### Vars

These live in `[env.production.vars]` in `apps/worker/wrangler.toml`; change them there and deploy, not in the dashboard.

| Variable               | Purpose                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `APP_URL`              | Public base URL. Used in sign-in links, the digest footer and the auth origin check               |
| `MAIL_FROM`            | Sender of sign-in links, digests and owner alerts (`PriceDawn <pricedawn@mail.spacesonlabs.com>`) |
| `DEV_ROUTES`           | Must stay `"0"` in production: turns off `/dev/*`, the dev outbox and the fake-store switch       |
| `PADDLE_ENV`           | `"production"` for the live account, `"sandbox"` for a dry run                                    |
| `PADDLE_CLIENT_TOKEN`  | Paddle.js client-side token used by checkout                                                      |
| `PADDLE_PRICE_STARTER` | Paddle price id for Starter, $19/mo                                                               |
| `PADDLE_PRICE_PRO`     | Paddle price id for Pro, $49/mo                                                                   |
| `OWNER_ALERT_EMAIL`    | Gets at most one mail an hour for bad webhook signatures and failed payments                      |

`DEV_STORE_ORIGIN` exists only for local runs and e2e: it points price checks at a fake store. Never set it in `[env.production]`.

### Secrets

Each command prompts for the value; never put them in `wrangler.toml`.

```sh
openssl rand -base64 48 | pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put RESEND_API_KEY --env production
pnpm exec wrangler secret put PADDLE_API_KEY --env production
pnpm exec wrangler secret put PADDLE_WEBHOOK_SECRET --env production
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env production       # optional, step 6
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production   # optional, step 6
```

### Bindings

| Binding         | What                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `DB`            | The D1 database from step 2                                           |
| `ASSETS`        | The built SPA in `apps/web/dist` (static pages, `/app-shell`, `/404`) |
| `AUTH_LIMITER`  | 30 auth writes per IP per minute, namespace `1003`                    |
| `LINKS_LIMITER` | 30 link pastes per account per minute, namespace `1004`               |

A rate-limit namespace id is shared by every Worker on the same Cloudflare account. PriceDawn uses `1003` and `1004` so its counters stay separate from a sister product's `1001`/`1002`. Never reuse a namespace across products.

### Crons

`[env.production.triggers].crons` has one entry, `* * * * *`. Every tick except :00 runs the due link checks; the :00 tick runs the morning digests and purges old rate-limit rows.

## 8. Build and deploy

Build the SPA, then run the launch checklist script from the repository root: it must exit 0, and anything it reports must be fixed before deploying.

```sh
VITE_TURNSTILE_SITE_KEY=<site key from 5> pnpm --filter @price-watch/web build   # from the repo root: builds and prerenders apps/web/dist
cd apps/worker
pnpm exec wrangler deploy --dry-run --env production   # check the bindings list
pnpm exec wrangler deploy --env production
```

The custom-domain route in `wrangler.toml` attaches `pricedawn.spacesonlabs.com` to the Worker and creates its DNS record. The cron trigger comes from `[env.production.triggers]`.

## 9. Smoke test (about 10 minutes)

1. Open `https://pricedawn.spacesonlabs.com`, then `/pricing`, `/prisync-alternative`, `/track-shopify-competitor-prices`, `/terms`, `/privacy`, `/refunds`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`. `curl -sI https://pricedawn.spacesonlabs.com` shows `content-security-policy` and `strict-transport-security`. `curl -sI https://pricedawn.spacesonlabs.com/foo` answers `404` with `x-robots-tag: noindex`. Submit the sitemap in Google Search Console.
2. Sign in with your own email: the Turnstile box turns green and the magic link arrives from `pricedawn@mail.spacesonlabs.com`. If step 6 is done, sign out and use **Continue with Google** with the same address: you land in the same account.
3. `curl -i https://pricedawn.spacesonlabs.com/dev/outbox` must answer `404` (dev routes are off). Do not paste that URL into the browser before this check.
4. Pick Starter with a real card (refund it afterwards in Paddle). Billing should show Active within seconds; Paddle → Notifications → the destination's log should show `200` responses.
5. Paste three product links from one real Shopify store. Each appears right away and shows 'Checking…'; within a minute the every-minute cron checks it and the price, title and variant appear with status `ok`. A copy of the product URL with no `/products/` path is rejected as not a product link.
6. Open the CSV export: it downloads `pricedawn-history.csv` with one row per stored price.
7. Billing → Manage billing opens the Paddle portal. Cancel the subscription and switch back, refunding as needed.
8. The morning digest is the one part that needs tomorrow: open the app once from a browser in your time zone (the header shows 'Daily email at 7:00 (<zone>)'), and next morning after 07:00 local check that one email lists the store, product, old → new price and percent, or that a quiet day sent nothing. A store that blocks bots shows `blocked` in the app and under `Couldn't check:` in the digest.
