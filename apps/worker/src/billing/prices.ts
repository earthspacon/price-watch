import type { Plan } from "@price-watch/contract";

import type { Env } from "../env";

export function buildPriceTable(env: Env): Record<Plan, string | null> {
  return {
    starter: env.PADDLE_PRICE_STARTER || null,
    pro: env.PADDLE_PRICE_PRO || null,
  };
}

export function findPlanByPrice({ env, priceId }: { env: Env; priceId: string | null }): Plan | null {
  if (!priceId) {
    return null;
  }
  const table = buildPriceTable(env);
  const plans: Plan[] = ["starter", "pro"];
  return (
    plans.find((plan) => {
      return table[plan] === priceId;
    }) ?? null
  );
}
