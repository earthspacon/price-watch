import { handleRequest } from "./app";
import { createDeps } from "./deps";
import { runDigests } from "./digest/run-digests";
import type { Env } from "./env";
import { runChecks } from "./links/run-checks";
import { purgeOldRateLimitHits } from "./repo/shield";

const HOURLY_MINUTE = 0;

export default {
  async fetch(request, env, ctx) {
    return handleRequest({ deps: createDeps({ env, ctx }), request });
  },
  async scheduled(controller, env, ctx) {
    const deps = createDeps({ env, ctx });

    // Three products share the Free plan's 5 cron triggers, so one minute trigger runs every job.
    // The top-of-hour tick does the hourly work instead of the checks, keeping each invocation within its limits.
    if (new Date(controller.scheduledTime).getUTCMinutes() !== HOURLY_MINUTE) {
      deps.schedule(runChecks({ deps, now: deps.now() }));
      return;
    }
    deps.schedule(runDigests({ deps, now: deps.now() }));
    deps.schedule(purgeOldRateLimitHits({ db: deps.db, now: deps.now() }));
  },
} satisfies ExportedHandler<Env>;
