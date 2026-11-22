import type { BillingDto, MeDto } from "@price-watch/contract";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { apiFetch, countOutbox, countRows, db, postLinks, uniqueEmail } from "./helpers";
import {
  buildPaddleEvent,
  fakePaddleApi,
  PADDLE_FIXTURES,
  PADDLE_SANDBOX_API,
  postPaddleEvent,
  sendFixture,
} from "./paddle";
import { signInAccount } from "./session";

const STARTER_LINK_LIMIT = 250;
const PORTAL_URL = "https://customer-portal.paddle.com/cpl_01jtestportal";
const FIXTURE_CUSTOMER_ID: string = JSON.parse(PADDLE_FIXTURES.activated).data.customer_id;

async function readMe({ cookie }: { cookie: string }) {
  const response = await apiFetch({ cookie, path: "/api/me" });
  expect(response.status, "GET /api/me").toBe(200);
  return response.json<MeDto>();
}

async function signInActiveStarter({ prefix }: { prefix: string }) {
  const account = await signInAccount({ email: uniqueEmail({ prefix }) });
  const activated = await sendFixture({ fixture: "activated", accountId: account.accountId });
  expect(activated.status, "subscription.activated webhook").toBe(200);
  return account;
}

function countOwnerMails() {
  return countOutbox({ to: env.OWNER_ALERT_EMAIL });
}

describe("billing", () => {
  beforeEach(async () => {
    await db.prepare("DELETE FROM owner_alerts").run();
  });

  it("R5: without a client token billing says checkout is unavailable", async () => {
    const { cookie } = await signInAccount({ email: uniqueEmail({ prefix: "no-token" }) });

    const response = await apiFetch({ cookie, path: "/api/billing" });

    expect(response.status).toBe(200);
    expect(await response.json<BillingDto>()).toEqual({
      plan: null,
      subscription: "no_subscription",
      nextBilledAt: null,
      checkout: null,
    });
  });

  it("R6: a signed activation turns tracking on with the Starter limit", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "activate" }) });

    const response = await sendFixture({ fixture: "activated", accountId });

    expect(response.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({
      plan: "starter",
      subscription: "active",
      linkLimit: STARTER_LINK_LIMIT,
    });
  });

  it("R6: a bad signature gets 401, changes nothing and alerts the owner once", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "forged" }) });
    const ownerMailsBefore = await countOwnerMails();

    const first = await postPaddleEvent({
      body: buildPaddleEvent({ fixture: "activated", accountId }),
      secret: "not-the-webhook-secret",
    });
    const second = await postPaddleEvent({
      body: buildPaddleEvent({ fixture: "activated", accountId }),
      secret: "not-the-webhook-secret",
    });

    expect([first.status, second.status]).toEqual([401, 401]);
    expect(await readMe({ cookie })).toMatchObject({ plan: null, subscription: "no_subscription" });
    expect(await countOwnerMails()).toBe(ownerMailsBefore + 1);
  });

  it("R6: a replayed event changes nothing", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "replay" }) });
    const activation = buildPaddleEvent({ fixture: "activated", accountId });
    expect((await postPaddleEvent({ body: activation })).status).toBe(200);
    expect((await sendFixture({ fixture: "canceled", accountId })).status).toBe(200);

    const replay = await postPaddleEvent({ body: activation });

    expect(replay.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({ subscription: "canceled" });
    expect(
      await countRows({
        sql: "SELECT COUNT(*) AS n FROM paddle_events WHERE event_id = ?",
        binds: [JSON.parse(activation).event_id],
      }),
    ).toBe(1);
  });

  it("R6: an event whose apply fails is applied when Paddle redelivers it", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "redeliver" }) });
    const activation = buildPaddleEvent({ fixture: "activated", accountId });
    await db.exec(
      "CREATE TRIGGER fail_subscription_write BEFORE UPDATE ON subscriptions BEGIN SELECT RAISE(ABORT, 'disk error'); END",
    );

    const failed = await postPaddleEvent({ body: activation });
    await db.exec("DROP TRIGGER fail_subscription_write");
    const redelivered = await postPaddleEvent({ body: activation });

    expect(failed.status).toBe(500);
    expect(redelivered.status).toBe(200);
    expect(await redelivered.json()).toMatchObject({ outcome: expect.not.stringMatching(/duplicate/) });
    expect(await readMe({ cookie })).toMatchObject({ subscription: "active" });
  });

  it("R6: a failed payment alerts the owner", async () => {
    const { accountId } = await signInActiveStarter({ prefix: "card-declined" });
    const ownerMailsBefore = await countOwnerMails();

    const response = await sendFixture({ fixture: "paymentFailed", accountId });

    expect(response.status).toBe(200);
    expect(await countOwnerMails()).toBe(ownerMailsBefore + 1);
  });

  it("R7: without a live plan adding links is refused but reading works", async () => {
    const noPlan = await signInAccount({ email: uniqueEmail({ prefix: "no-plan" }) });
    const canceled = await signInAccount({
      email: uniqueEmail({ prefix: "canceled" }),
      plan: "starter",
      status: "canceled",
    });

    for (const { cookie } of [noPlan, canceled]) {
      const added = await postLinks({ cookie, text: "https://rival.example/products/linen-shirt" });
      const list = await apiFetch({ cookie, path: "/api/links" });
      const csv = await apiFetch({ cookie, path: "/api/export.csv" });

      expect(added.status).toBe(403);
      expect(await added.json()).toMatchObject({ error: "no_plan" });
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([]);
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toMatch(/^text\/csv/);
    }
  });

  it("R8: switching to Pro sends a prorated update with the Pro price", async () => {
    const { accountId, cookie } = await signInActiveStarter({ prefix: "upgrade" });
    const paddle = fakePaddleApi({
      reply: () => {
        return Response.json({ data: { id: `sub_${accountId}`, status: "active" } });
      },
    });

    try {
      const response = await apiFetch({ cookie, path: "/api/billing/switch", method: "POST", body: { plan: "pro" } });

      expect(response.status).toBe(204);
      expect(paddle.calls).toEqual([
        {
          method: "PATCH",
          url: `${PADDLE_SANDBOX_API}/subscriptions/sub_${accountId}`,
          authorization: `Bearer ${env.PADDLE_API_KEY}`,
          body: expect.objectContaining({
            items: [{ price_id: env.PADDLE_PRICE_PRO, quantity: 1 }],
            proration_billing_mode: expect.stringMatching(/^prorated_/),
          }),
        },
      ]);
    } finally {
      paddle.restore();
    }
  });

  it("R8: manage billing returns a Paddle portal link", async () => {
    const { cookie } = await signInActiveStarter({ prefix: "portal" });
    const paddle = fakePaddleApi({
      reply: () => {
        return Response.json({ data: { urls: { general: { overview: PORTAL_URL } } } });
      },
    });

    try {
      const response = await apiFetch({ cookie, path: "/api/billing/portal", method: "POST" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ url: PORTAL_URL });
      expect(paddle.calls).toHaveLength(1);
      expect(paddle.calls[0]).toMatchObject({
        method: "POST",
        url: `${PADDLE_SANDBOX_API}/customers/${FIXTURE_CUSTOMER_ID}/portal-sessions`,
      });
    } finally {
      paddle.restore();
    }
  });
});
