import type { MeDto } from "@price-watch/contract";
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "../src/repo/shield";
import { apiFetch, countOutbox, countRows, db, uniqueEmail } from "./helpers";
import {
  BASE,
  findSessionCookie,
  followMagicLink,
  readMagicLink,
  readOutbox,
  readSessionCookie,
  requestMagicLink,
} from "./session";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const CLOCK_SLACK_MS = 60 * 1000;
const EMAIL_LINKS_PER_WINDOW = 3;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_KEYS = {
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
};

const NO_PLAN_ME = {
  plan: null,
  subscription: "no_subscription",
  linkLimit: 0,
  linkCount: 0,
};

function encodeSegment({ value }: { value: object }) {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

// The Google token endpoint answers the code exchange with an id_token carrying `profile`.
function fakeGoogleToken({ profile }: { profile: Record<string, unknown> }) {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);

    if (request.url !== GOOGLE_TOKEN_URL) {
      return previousFetch(input, init);
    }
    const idToken = [
      encodeSegment({ value: { alg: "RS256", kid: "test" } }),
      encodeSegment({
        value: { iss: "https://accounts.google.com", aud: GOOGLE_KEYS.GOOGLE_CLIENT_ID, ...profile },
      }),
      "signature",
    ].join(".");
    return Response.json({
      access_token: "ya29.test",
      expires_in: 3599,
      token_type: "Bearer",
      scope: "openid email profile",
      id_token: idToken,
    });
  };
  return () => {
    globalThis.fetch = previousFetch;
  };
}

async function signInWithGoogle({ email }: { email: string }) {
  const started = await apiFetch({
    path: "/api/auth/sign-in/social",
    method: "POST",
    body: { provider: "google", callbackURL: "/app", errorCallbackURL: "/sign-in" },
  });
  expect(started.status, "POST /api/auth/sign-in/social").toBe(200);
  const { url } = await started.json<{ url: string }>();
  const state = new URL(url).searchParams.get("state") ?? "";
  const cookies = started.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const restoreFetch = fakeGoogleToken({
    profile: { sub: `google-${crypto.randomUUID()}`, email, email_verified: true, name: "Test Person" },
  });

  try {
    return await apiFetch({
      cookie: cookies,
      path: `/api/auth/callback/google?code=test-code&state=${encodeURIComponent(state)}`,
    });
  } finally {
    restoreFetch();
  }
}

describe("sign-in", () => {
  it("/login sends people to the sign-in page", async () => {
    const response = await SELF.fetch(`${BASE}/login`, { redirect: "manual" });

    expect(response.status).toBe(301);
    expect(new URL(response.headers.get("location") ?? "", BASE).pathname).toBe("/sign-in");
  });

  it("R1: a new email gets a one-use 15-minute link that opens a session", async () => {
    const email = uniqueEmail({ prefix: "new" });

    const requested = await requestMagicLink({ email });

    expect(requested.status).toBe(200);
    expect(await readOutbox({ to: email })).toHaveLength(1);
    const token = await db
      .prepare("SELECT expires_at AS expiresAt FROM magic_links WHERE value LIKE ?")
      .bind(`%${email}%`)
      .first<{ expiresAt: string }>();
    const ttl = new Date(token?.expiresAt ?? 0).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(MAGIC_LINK_TTL_MS - CLOCK_SLACK_MS);
    expect(ttl).toBeLessThanOrEqual(MAGIC_LINK_TTL_MS);

    const opened = await followMagicLink({ link: await readMagicLink({ email }) });
    expect(opened.status).toBe(302);
    expect(new URL(opened.headers.get("location") ?? "", BASE).pathname).toBe("/app");
    const me = await apiFetch({ cookie: readSessionCookie({ response: opened }), path: "/api/me" });
    expect(me.status).toBe(200);
    expect(await me.json<MeDto>()).toEqual({ email, timeZone: null, ...NO_PLAN_ME });
  });

  it("R1: a used link does not sign in again", async () => {
    const email = uniqueEmail({ prefix: "reuse" });
    expect((await requestMagicLink({ email })).status).toBe(200);
    const link = await readMagicLink({ email });

    const first = await followMagicLink({ link });
    const second = await followMagicLink({ link });

    expect(findSessionCookie({ response: first })).toBeDefined();
    expect(second.status).toBe(302);
    expect(new URL(second.headers.get("location") ?? "", BASE).pathname).toBe("/sign-in");
    expect(findSessionCookie({ response: second })).toBeUndefined();
  });

  it("R2: a Google sign-in creates an account without a plan", async () => {
    const email = uniqueEmail({ prefix: "google" });
    Object.assign(env, GOOGLE_KEYS);

    try {
      const response = await signInWithGoogle({ email });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", BASE).pathname).toBe("/app");
      const me = await apiFetch({ cookie: readSessionCookie({ response }), path: "/api/me" });
      expect(await me.json<MeDto>()).toMatchObject({ email, ...NO_PLAN_ME });
      expect(
        await countRows({
          sql: "SELECT COUNT(*) AS n FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.email = ?",
          binds: [email],
        }),
      ).toBe(1);
      expect(await countOutbox({ to: email })).toBe(0);
    } finally {
      delete env.GOOGLE_CLIENT_ID;
      delete env.GOOGLE_CLIENT_SECRET;
    }
  });

  it("R2: without Google keys sign-in options say google false", async () => {
    const response = await apiFetch({ path: "/api/sign-in-options" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ google: false });
  });

  it("R3: a failed Turnstile check sends no mail", async () => {
    const email = uniqueEmail({ prefix: "bot" });

    const response = await requestMagicLink({ email, turnstileToken: "forged-token" });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "captcha_failed" });
    expect(await countOutbox({ to: email })).toBe(0);
  });

  it("R3: a disposable domain gets 400 and no mail", async () => {
    const email = `someone-${crypto.randomUUID().slice(0, 6)}@mailinator.com`;

    const response = await requestMagicLink({ email });

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string; message: string }>();
    expect(body.error).toBe("disposable_email");
    expect(body.message).toMatch(/^Use your work or personal email/);
    expect(await countOutbox({ to: email })).toBe(0);
  });

  it("R3: the 4th link for one email within 15 minutes gets 429", async () => {
    const email = uniqueEmail({ prefix: "flood" });

    const statuses = [];
    for (let attempt = 0; attempt <= EMAIL_LINKS_PER_WINDOW; attempt += 1) {
      statuses.push((await requestMagicLink({ email })).status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(await countOutbox({ to: email })).toBe(EMAIL_LINKS_PER_WINDOW);
  });

  it("R3: parallel requests for one key never pass more than the limit", async () => {
    const key = `parallel:${uniqueEmail({ prefix: "race" })}`;
    const now = new Date();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        consumeRateLimit({ db, key, limit: EMAIL_LINKS_PER_WINDOW, windowMs: 60_000, now }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(EMAIL_LINKS_PER_WINDOW);
  });
});
