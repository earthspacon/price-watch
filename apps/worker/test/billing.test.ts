import type { BillingDto, MeDto } from "@price-watch/contract";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { apiFetch, countOutbox, countRows, db, postLinks, uniqueEmail } from "./helpers";
import {
  buildPaddleEvent,
  fakePaddleApi,
  PADDLE_FIXTURES,
  PADDLE_SANDBOX_API,
  type PaddleFixture,
  postPaddleEvent,
  sendFixture,
} from "./paddle";
import { signInAccount } from "./session";

const PAID_LINK_LIMIT = 500;
const PORTAL_URL = "https://customer-portal.paddle.com/cpl_01jtestportal";
const FIXTURE_CUSTOMER_ID: string = JSON.parse(PADDLE_FIXTURES.activated).data.customer_id;

async function readMe({ cookie }: { cookie: string }) {
  const response = await apiFetch({ cookie, path: "/api/me" });
  expect(response.status, "GET /api/me").toBe(200);
  return response.json<MeDto>();
}

async function signInActivePaid({ prefix }: { prefix: string }) {
  const account = await signInAccount({ email: uniqueEmail({ prefix }) });
  const activated = await sendFixture({ fixture: "activated", accountId: account.accountId });
  expect(activated.status, "subscription.activated webhook").toBe(200);
  return account;
}

function buildYearlyEvent({ fixture, accountId }: { fixture: PaddleFixture; accountId: string }) {
  return buildPaddleEvent({ fixture, accountId }).replaceAll(env.PADDLE_PRICE, env.PADDLE_PRICE_YEARLY);
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

  it("R6: a signed activation turns tracking on with the paid plan limit", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "activate" }) });

    const response = await sendFixture({ fixture: "activated", accountId });

    expect(response.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({
      plan: "paid",
      subscription: "active",
      linkLimit: PAID_LINK_LIMIT,
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
    const { accountId } = await signInActivePaid({ prefix: "card-declined" });
    const ownerMailsBefore = await countOwnerMails();

    const response = await sendFixture({ fixture: "paymentFailed", accountId });

    expect(response.status).toBe(200);
    expect(await countOwnerMails()).toBe(ownerMailsBefore + 1);
  });

  it("R7: without a live plan adding links is refused but reading works", async () => {
    const noPlan = await signInAccount({ email: uniqueEmail({ prefix: "no-plan" }) });
    const canceled = await signInAccount({
      email: uniqueEmail({ prefix: "canceled" }),
      plan: "paid",
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

  it("R6: a yearly subscription.created turns tracking on with the paid plan limit", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "yearly-created" }) });
    const body = buildYearlyEvent({ fixture: "created", accountId });

    const response = await postPaddleEvent({ body });

    expect(response.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({
      plan: "paid",
      subscription: "active",
      linkLimit: PAID_LINK_LIMIT,
    });
  });

  it("R6: a yearly subscription.updated keeps the paid plan", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "yearly-updated" }) });
    await postPaddleEvent({ body: buildYearlyEvent({ fixture: "activated", accountId }) });

    const response = await postPaddleEvent({ body: buildYearlyEvent({ fixture: "scheduledCancel", accountId }) });

    expect(response.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({
      plan: "paid",
      subscription: "active",
      linkLimit: PAID_LINK_LIMIT,
    });
  });

  it("R6: an activation on any other price, like the old $9 one, turns nothing on", async () => {
    const { accountId, cookie } = await signInAccount({ email: uniqueEmail({ prefix: "old-price" }) });
    const body = buildPaddleEvent({ fixture: "activated", accountId }).replaceAll(env.PADDLE_PRICE, "pri_old_starter");

    const response = await postPaddleEvent({ body });

    expect(response.status).toBe(200);
    expect(await readMe({ cookie })).toMatchObject({ plan: null, subscription: "no_subscription", linkLimit: 0 });
  });

  it("R8: there is no plan to switch to", async () => {
    const { cookie } = await signInActivePaid({ prefix: "no-switch" });

    const response = await apiFetch({ cookie, path: "/api/billing/switch", method: "POST", body: { plan: "paid" } });

    expect(response.status).toBe(404);
  });

  it("R8: manage billing returns a Paddle portal link", async () => {
    const { cookie } = await signInActivePaid({ prefix: "portal" });
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
