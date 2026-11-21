import { isLive, PLANS, type MeDto } from "@price-watch/contract";

import { json, route, type Route } from "../http";
import type { ApiContext } from "./context";

// Link counts arrive with the links feature.
export const accountRoutes: Route<ApiContext>[] = [
  route("GET", "/api/me", async ({ account }) => {
    const me: MeDto = {
      email: account.email,
      plan: account.plan,
      subscription: account.subscription,
      linkLimit: account.plan && isLive(account.subscription) ? PLANS[account.plan].linkLimit : 0,
      linkCount: 0,
      timeZone: account.timeZone,
    };
    return json(me);
  }),
];
