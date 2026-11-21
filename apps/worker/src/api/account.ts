import type { MeDto } from "@price-watch/contract";

import { HttpError, json, readJson, readString, route, type Route } from "../http";
import { getLinkLimit, setAccountTimeZone } from "../repo/accounts";
import { countLinks } from "../repo/links";
import type { ApiContext } from "./context";

const TIME_ZONE_MAX_LENGTH = 64;

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

  route("PUT", "/api/account/time-zone", async ({ deps, account, request }) => {
    const timeZone = readString({
      data: await readJson(request),
      key: "timeZone",
      maxLength: TIME_ZONE_MAX_LENGTH,
    }).trim();

    if (!isKnownTimeZone({ timeZone })) {
      throw new HttpError(400, "invalid_field", '"timeZone" must be an IANA time zone');
    }
    await setAccountTimeZone({ db: deps.db, accountId: account.accountId, timeZone });
    return new Response(null, { status: 204 });
  }),
];

function isKnownTimeZone({ timeZone }: { timeZone: string }) {
  try {
    return Boolean(new Intl.DateTimeFormat("en-US", { timeZone }));
  } catch {
    return false;
  }
}
