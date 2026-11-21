import type { Plan, SubscriptionStatus } from "@price-watch/contract";
import { SELF } from "cloudflare:test";
import { expect } from "vitest";

export const BASE = "http://localhost:8787";
// The token Turnstile's test sitekeys produce; the test secret key accepts only this one.
export const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const LINK_PATTERN = /https?:\/\/\S+\/api\/auth\/magic-link\/verify\S+/;
const SESSION_COOKIE_PATTERN = /session_token=[^;]+/;

export type OutboxMail = { to: string; subject: string; body: string; createdAt: string };

export async function requestMagicLink({
  email,
  turnstileToken = TURNSTILE_TEST_TOKEN,
  ip,
}: {
  email: string;
  turnstileToken?: string;
  ip?: string;
}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: BASE,
    "x-turnstile-token": turnstileToken,
  });
  if (ip) {
    headers.set("cf-connecting-ip", ip);
  }
  return SELF.fetch(`${BASE}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      callbackURL: "/app",
      errorCallbackURL: "/sign-in",
    }),
  });
}

export async function readOutbox({ to }: { to: string }) {
  const response = await SELF.fetch(`${BASE}/dev/outbox?to=${encodeURIComponent(to)}`);
  expect(response.status).toBe(200);
  return response.json<OutboxMail[]>();
}

export async function readMagicLink({ email }: { email: string }) {
  const mails = await readOutbox({ to: email });
  const link = mails[0]?.body.match(LINK_PATTERN)?.[0];
  expect(link, "a sign-in link in the dev outbox").toBeDefined();
  return link ?? "";
}

export async function followMagicLink({ link }: { link: string }) {
  return SELF.fetch(link, { redirect: "manual" });
}

export function findSessionCookie({ response }: { response: Response }) {
  return response.headers.getSetCookie().find((value) => {
    return SESSION_COOKIE_PATTERN.test(value);
  });
}

export function readSessionCookie({ response }: { response: Response }) {
  const cookie = findSessionCookie({ response });
  expect(cookie, "a session cookie").toBeDefined();
  return (cookie ?? "").split(";")[0];
}

export async function signIn({ email }: { email: string }) {
  const requested = await requestMagicLink({ email });
  expect(requested.status).toBe(200);
  const response = await followMagicLink({ link: await readMagicLink({ email }) });
  return readSessionCookie({ response });
}

// Dev route: creates the user and the account, with a subscription when a plan is given.
export async function createAccount({
  email,
  plan,
  status,
}: {
  email: string;
  plan?: Plan;
  status?: SubscriptionStatus;
}) {
  const response = await SELF.fetch(`${BASE}/dev/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, plan, status }),
  });
  expect(response.ok, `POST /dev/accounts answered ${response.status}`).toBe(true);
  return response.json<{ accountId: string }>();
}

export async function signInAccount({
  email,
  plan,
  status,
}: {
  email: string;
  plan?: Plan;
  status?: SubscriptionStatus;
}) {
  const { accountId } = await createAccount({ email, plan, status });
  return {
    accountId,
    cookie: await signIn({ email }),
  };
}
