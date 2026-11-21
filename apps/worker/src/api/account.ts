import type { MeDto } from "@price-watch/contract";

import { json, route, type Route } from "../http";
import { getLinkLimit } from "../repo/accounts";
import { countLinks } from "../repo/links";
import type { ApiContext } from "./context";

export const accountRoutes: Route<ApiContext>[] = [
  route("GET", "/api/me", async ({ deps, account }) => {
    const me: MeDto = {
      email: account.email,
      plan: account.plan,
      subscription: account.subscription,
      linkLimit: getLinkLimit({ account }),
      linkCount: await countLinks({ db: deps.db, accountId: account.accountId }),
      timeZone: account.timeZone,
    };
    return json(me);
  }),
];
