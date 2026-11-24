import type { BillingPeriod, Plan } from "@price-watch/contract";

import type { Env } from "../env";

export function findPriceIds(env: Env): Record<BillingPeriod, string | null> {
  return {
    monthly: env.PADDLE_PRICE || null,
    yearly: env.PADDLE_PRICE_YEARLY || null,
  };
}

// The monthly and the yearly price both buy the one paid plan.
export function findPlanByPrice({ env, priceId }: { env: Env; priceId: string | null }): Plan | null {
  if (!priceId) {
    return null;
  }
  return Object.values(findPriceIds(env)).includes(priceId) ? "paid" : null;
}
