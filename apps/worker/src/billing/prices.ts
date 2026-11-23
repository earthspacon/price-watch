import type { Plan } from "@price-watch/contract";

import type { Env } from "../env";

export function findPlanByPrice({ env, priceId }: { env: Env; priceId: string | null }): Plan | null {
  if (!priceId || !env.PADDLE_PRICE) {
    return null;
  }
  return priceId === env.PADDLE_PRICE ? "paid" : null;
}
