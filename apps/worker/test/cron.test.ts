import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";
import { countRows, db } from "./helpers";

const EVERY_MINUTE_CRON = "* * * * *";
const MINUTE_MS = 60_000;
const TWO_DAYS_MS = 2 * 24 * 60 * MINUTE_MS;

async function runTick({ at }: { at: Date }) {
  const ctx = createExecutionContext();
  await worker.scheduled(createScheduledController({ cron: EVERY_MINUTE_CRON, scheduledTime: at.getTime() }), env, ctx);
  await waitOnExecutionContext(ctx);
}

function nextHourOf(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours() + 1));
}

describe("Cron", () => {
  it("the minute trigger runs the hourly jobs only at the top of an hour", async () => {
    const key = `cron-test-${crypto.randomUUID()}`;
    await db
      .prepare("INSERT INTO rate_limit_hits (key, hit_at) VALUES (?, ?)")
      .bind(key, new Date(Date.now() - TWO_DAYS_MS).toISOString())
      .run();
    const countHits = () => {
      return countRows({ sql: "SELECT COUNT(*) AS n FROM rate_limit_hits WHERE key = ?", binds: [key] });
    };
    const topOfHour = nextHourOf(new Date());

    await runTick({ at: new Date(topOfHour.getTime() + MINUTE_MS) });
    expect(await countHits()).toBe(1);

    await runTick({ at: topOfHour });
    expect(await countHits()).toBe(0);
  });
});
