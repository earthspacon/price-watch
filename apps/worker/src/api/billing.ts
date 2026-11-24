import type { BillingDto } from "@price-watch/contract";

import { createPortalSession, getPaddleEnvironment } from "../billing/paddle-api";
import { findPriceIds } from "../billing/prices";
import type { Deps } from "../deps";
import { HttpError, json, route, type Route } from "../http";
import { getBillingRow } from "../repo/accounts";
import type { ApiContext } from "./context";

export const billingRoutes: Route<ApiContext>[] = [
  route("GET", "/api/billing", async ({ deps, account }) => {
    return json(await loadBilling({ deps, accountId: account.accountId }));
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

async function requireBillingRow({ deps, accountId }: { deps: Deps; accountId: string }) {
  const row = await getBillingRow({ db: deps.db, accountId });

  if (!row) {
    throw new HttpError(404, "not_found", "No subscription record");
  }
  return row;
}

async function loadBilling({ deps, accountId }: { deps: Deps; accountId: string }) {
  const row = await requireBillingRow({ deps, accountId });
  const priceIds = findPriceIds(deps.env);
  const clientToken = deps.env.PADDLE_CLIENT_TOKEN;
  const billing: BillingDto = {
    plan: row.plan,
    subscription: row.status,
    nextBilledAt: row.next_billed_at,
    checkout:
      clientToken && priceIds.monthly
        ? {
            accountId,
            clientToken,
            environment: getPaddleEnvironment(deps.env),
            priceIds,
          }
        : null,
  };
  return billing;
}
