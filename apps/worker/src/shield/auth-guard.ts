import type { Deps } from "../deps";
import { HttpError, isRecord } from "../http";
import { consumeRateLimit } from "../repo/shield";
import { isDisposableEmail } from "./disposable";
import { readClientIp, sha256Hex } from "./client";
import { TURNSTILE_HEADER, verifyTurnstile } from "./turnstile";

export const MAGIC_LINK_PATH = "/api/auth/sign-in/magic-link";
export const MAGIC_LINK_LIMITS = {
  perEmail: {
    limit: 3,
    windowMs: 15 * 60_000,
  },
  perIp: {
    limit: 10,
    windowMs: 60 * 60_000,
  },
};

const TOO_MANY_LINKS = "Too many sign-in links were requested. Wait a few minutes and try again";

// Runs before Better Auth: per-IP limit on every auth write, and the full shield before a magic link is mailed.
export async function guardAuthRequest({ deps, request }: { deps: Deps; request: Request }) {
  if (request.method !== "POST") {
    return;
  }

  const ip = readClientIp(request);
  if (ip && !(await deps.env.AUTH_LIMITER.limit({ key: `auth:${await sha256Hex(ip)}` })).success) {
    throw new HttpError(429, "rate_limited", "Too many requests. Wait a minute and try again");
  }
  if (new URL(request.url).pathname !== MAGIC_LINK_PATH) {
    return;
  }

  const body: unknown = await request
    .clone()
    .json()
    .catch(() => {
      return null;
    });
  const email = isRecord(body) && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (isDisposableEmail(email)) {
    throw new HttpError(400, "disposable_email", "Use your work or personal email: temporary addresses can't be used");
  }

  const isHuman = await verifyTurnstile({
    secret: deps.env.TURNSTILE_SECRET_KEY,
    token: request.headers.get(TURNSTILE_HEADER),
    ip,
  });
  if (!isHuman) {
    throw new HttpError(403, "captcha_failed", "We couldn't confirm you're human. Reload the page and try again");
  }

  const now = deps.now();
  const isEmailAllowed = await consumeRateLimit({
    db: deps.db,
    key: `magic-link:email:${await sha256Hex(email)}`,
    now,
    ...MAGIC_LINK_LIMITS.perEmail,
  });
  if (!isEmailAllowed) {
    throw new HttpError(429, "rate_limited", TOO_MANY_LINKS);
  }
  if (!ip) {
    return;
  }

  const isIpAllowed = await consumeRateLimit({
    db: deps.db,
    key: `magic-link:ip:${await sha256Hex(ip)}`,
    now,
    ...MAGIC_LINK_LIMITS.perIp,
  });
  if (!isIpAllowed) {
    throw new HttpError(429, "rate_limited", TOO_MANY_LINKS);
  }
}
