import type { Deps } from "../deps";
import { type CheckOutcome, type LeasedLink, leaseDueLinks, saveCheckOutcomes } from "../repo/links";
import { type CheckResult, checkLink, createStoreFetcher } from "./check";
import { DAILY_CHECK_HOUR, DEFAULT_TIME_ZONE, minutesLater, nextLocalTime, RETRY_DELAYS_MINUTES } from "./schedule";

// Free Workers allow 50 outgoing requests per invocation; 20 leaves room and keeps stores unbothered.
const LINKS_PER_RUN = 20;
const LINKS_PER_HOST_PER_RUN = 3;
// Far longer than a run (10 s fetch timeout), so a lease only outlives a run that crashed.
const LEASE_MINUTES = 10;

export async function runChecks({ deps, now }: { deps: Deps; now: Date }) {
  const links = await leaseDueLinks({
    db: deps.db,
    now,
    leasedUntil: minutesLater({ time: now, minutes: LEASE_MINUTES }),
    perRun: LINKS_PER_RUN,
    perHost: LINKS_PER_HOST_PER_RUN,
  });
  const fetchStore = createStoreFetcher({ env: deps.env });
  const outcomes = await Promise.all(
    links.map(async (link) => {
      const result = await checkLink({ link, fetchStore });
      return buildOutcome({ link, result, now });
    }),
  );

  await saveCheckOutcomes({ db: deps.db, outcomes, now });
  return outcomes.length;
}

function buildOutcome({ link, result, now }: { link: LeasedLink; result: CheckResult; now: Date }): CheckOutcome {
  const tomorrow = nextLocalTime({ now, timeZone: link.timeZone ?? DEFAULT_TIME_ZONE, hour: DAILY_CHECK_HOUR });

  if (result.kind === "ok") {
    return {
      link,
      status: "ok",
      failReason: null,
      attempts: 0,
      nextCheckAt: tomorrow,
      product: result,
    };
  }
  if (result.kind === "gone") {
    return {
      link,
      status: "failed",
      failReason: link.priceCents === null ? "not_shopify" : "unavailable",
      attempts: 0,
      nextCheckAt: tomorrow,
      product: null,
    };
  }
  if (link.attempts >= RETRY_DELAYS_MINUTES.length) {
    return {
      link,
      status: "failed",
      failReason: "blocked",
      attempts: 0,
      nextCheckAt: tomorrow,
      product: null,
    };
  }
  return {
    link,
    status: link.status,
    failReason: link.failReason,
    attempts: link.attempts + 1,
    nextCheckAt: minutesLater({ time: now, minutes: RETRY_DELAYS_MINUTES[link.attempts] }),
    product: null,
  };
}
