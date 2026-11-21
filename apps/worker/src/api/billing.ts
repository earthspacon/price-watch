import { isLive, PLANS, type BillingDto, type Plan } from "@price-watch/contract";

import { createPortalSession, getPaddleEnvironment, switchSubscriptionPrice } from "../billing/paddle-api";
import { buildPriceTable } from "../billing/prices";
import type { Deps } from "../deps";
import { HttpError, json, readJson, readString, route, type Route } from "../http";
import { getBillingRow } from "../repo/accounts";
import type { ApiContext } from "./context";

const PLAN_MAX_LENGTH = 16;

export const billingRoutes: Route<ApiContext>[] = [
  route("GET", "/api/billing", async ({ deps, account }) => {
    return json(await loadBilling({ deps, accountId: account.accountId }));
  }),

  route("POST", "/api/billing/switch", async ({ deps, account, request }) => {
    const data = await readJson(request);
    const target = readPlan(readString({ data, key: "plan", maxLength: PLAN_MAX_LENGTH }));
    const row = await requireBillingRow({ deps, accountId: account.accountId });

    if (!row.paddle_subscription_id || !isLive(row.status)) {
      throw new HttpError(409, "no_subscription", "There is no active subscription to switch");
    }
    if (row.plan === target) {
      throw new HttpError(409, "same_plan", `You're already on ${PLANS[target].name}`);
    }
    const priceId = buildPriceTable(deps.env)[target];
    if (!deps.env.PADDLE_API_KEY || !priceId) {
      throw new HttpError(503, "billing_unavailable", "Billing isn't configured on this server");
    }
    await switchSubscriptionPrice({
      env: deps.env,
      apiKey: deps.env.PADDLE_API_KEY,
      subscriptionId: row.paddle_subscription_id,
      priceId,
    });
    return new Response(null, { status: 204 });
  }),

  route("POST", "/api/billing/portal", async ({ deps, account }) => {
    const row = await getBillingRow({ db: deps.db, accountId: account.accountId });

    if (!row?.paddle_customer_id) {
      throw new HttpError(409, "no_customer", "There is no Paddle subscription to manage yet");
    }
    if (!deps.env.PADDLE_API_KEY) {
      throw new HttpError(503, "billing_unavailable", "Billing isn't configured on this server");
    }
    const url = await createPortalSession({
      env: deps.env,
      apiKey: deps.env.PADDLE_API_KEY,
      customerId: row.paddle_customer_id,
      subscriptionId: row.paddle_subscription_id,
    });
    return json({ url });
  }),
];

function isPlan(value: string): value is Plan {
  return Object.hasOwn(PLANS, value);
}

function readPlan(value: string) {
  if (!isPlan(value)) {
    throw new HttpError(400, "invalid_field", '"plan" must be "starter" or "pro"');
  }
  return value;
}

async function requireBillingRow({ deps, accountId }: { deps: Deps; accountId: string }) {
  const row = await getBillingRow({ db: deps.db, accountId });

  if (!row) {
    throw new HttpError(404, "not_found", "No subscription record");
  }
  return row;
}

async function loadBilling({ deps, accountId }: { deps: Deps; accountId: string }) {
  const row = await requireBillingRow({ deps, accountId });
  const { starter, pro } = buildPriceTable(deps.env);
  const clientToken = deps.env.PADDLE_CLIENT_TOKEN;
  const billing: BillingDto = {
    plan: row.plan,
    subscription: row.status,
    nextBilledAt: row.next_billed_at,
    checkout:
      clientToken && starter && pro
        ? {
            accountId,
            clientToken,
            environment: getPaddleEnvironment(deps.env),
            prices: { starter, pro },
          }
        : null,
  };
  return billing;
}
