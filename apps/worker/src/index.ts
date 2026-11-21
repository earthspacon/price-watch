import { handleRequest } from "./app";
import { createDeps } from "./deps";
import type { Env } from "./env";
import { runChecks } from "./links/run-checks";

const CHECK_CRON = "* * * * *";

export default {
  async fetch(request, env, ctx) {
    return handleRequest({ deps: createDeps({ env, ctx }), request });
  },
  async scheduled(controller, env, ctx) {
    const deps = createDeps({ env, ctx });

    if (controller.cron === CHECK_CRON) {
      deps.schedule(runChecks({ deps, now: deps.now() }));
    }
  },
} satisfies ExportedHandler<Env>;
