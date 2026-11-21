import { handleRequest } from "./app";
import { createDeps } from "./deps";
import { runDigests } from "./digest/run-digests";
import type { Env } from "./env";
import { runChecks } from "./links/run-checks";
import { purgeOldRateLimitHits } from "./repo/shield";

const CHECK_CRON = "* * * * *";
const DIGEST_CRON = "0 * * * *";

export default {
  async fetch(request, env, ctx) {
    return handleRequest({ deps: createDeps({ env, ctx }), request });
  },
  async scheduled(controller, env, ctx) {
    const deps = createDeps({ env, ctx });

    if (controller.cron === CHECK_CRON) {
      deps.schedule(runChecks({ deps, now: deps.now() }));
    }
    if (controller.cron === DIGEST_CRON) {
      deps.schedule(runDigests({ deps, now: deps.now() }));
      deps.schedule(purgeOldRateLimitHits({ db: deps.db, now: deps.now() }));
    }
  },
} satisfies ExportedHandler<Env>;
