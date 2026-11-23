import { env, SELF } from "cloudflare:test";

import activated from "../fixtures/paddle/subscription.activated.json?raw";
import canceled from "../fixtures/paddle/subscription.canceled.json?raw";
import created from "../fixtures/paddle/subscription.created.json?raw";
import pastDue from "../fixtures/paddle/subscription.past_due.json?raw";
import scheduledCancel from "../fixtures/paddle/subscription.updated-scheduled-cancel.json?raw";
import paymentFailed from "../fixtures/paddle/transaction.payment_failed.json?raw";
import { BASE } from "./session";

export const PADDLE_FIXTURES = {
  created,
  activated,
  scheduledCancel,
  pastDue,
  canceled,
  paymentFailed,
};

export type PaddleFixture = keyof typeof PADDLE_FIXTURES;

export const PADDLE_SANDBOX_API = "https://sandbox-api.paddle.com";
const MS_PER_SECOND = 1000;
const encoder = new TextEncoder();

// Fills the fixture for one account: a fresh event id, the account in custom_data and the event time.
export function buildPaddleEvent({
  fixture,
  accountId,
  occurredAt = new Date(),
}: {
  fixture: PaddleFixture;
  accountId: string;
  occurredAt?: Date;
}) {
  const event = JSON.parse(PADDLE_FIXTURES[fixture]);
  event.event_id = `evt_${crypto.randomUUID().replaceAll("-", "")}`;
  event.occurred_at = occurredAt.toISOString();
  event.data.custom_data = { account_id: accountId };

  // One Paddle subscription per test account, so accounts never collide on paddle_subscription_id.
  if (event.data.subscription_id !== undefined) {
    event.data.subscription_id = `sub_${accountId}`;
  } else {
    event.data.id = `sub_${accountId}`;
  }
  return JSON.stringify(event);
}

// Paddle-Signature is "ts=<unix seconds>;h1=<hex HMAC-SHA256 of `${ts}:${rawBody}`>". Signed here, independently of the worker.
async function signPayload({ ts, body, secret }: { ts: number; body: string; secret: string }) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${body}`));
  return [...new Uint8Array(mac)]
    .map((byte) => {
      return byte.toString(16).padStart(2, "0");
    })
    .join("");
}

export async function postPaddleEvent({
  body,
  secret = env.PADDLE_WEBHOOK_SECRET,
  ts = Math.floor(Date.now() / MS_PER_SECOND),
}: {
  body: string;
  secret?: string;
  ts?: number;
}) {
  const h1 = await signPayload({ ts, body, secret });
  return SELF.fetch(`${BASE}/paddle/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paddle-signature": `ts=${ts};h1=${h1}`,
    },
    body,
  });
}

export async function sendFixture({ fixture, accountId }: { fixture: PaddleFixture; accountId: string }) {
  return postPaddleEvent({ body: buildPaddleEvent({ fixture, accountId }) });
}

export type PaddleApiCall = { method: string; url: string; authorization: string | null; body: unknown };

// Answers every Paddle API call with `reply` and records it; anything else goes to the previous fetch.
export function fakePaddleApi({ reply }: { reply: (call: PaddleApiCall) => Response }) {
  const previousFetch = globalThis.fetch;
  const calls: PaddleApiCall[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);

    if (!request.url.startsWith(PADDLE_SANDBOX_API)) {
      return previousFetch(input, init);
    }
    const text = await request.text();
    const call = {
      method: request.method,
      url: request.url,
      authorization: request.headers.get("authorization"),
      body: text ? JSON.parse(text) : null,
    };
    calls.push(call);
    return reply(call);
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = previousFetch;
    },
  };
}
