import { handleRequest } from "./app";
import { createDeps } from "./deps";
import type { Env } from "./env";

export default {
  async fetch(request, env, ctx) {
    return handleRequest({ deps: createDeps({ env, ctx }), request });
  },
  async scheduled() {},
} satisfies ExportedHandler<Env>;
