import type { Env } from "./env";

const NOT_FOUND_STATUS = 404;

export default {
  async fetch() {
    return Response.json({ error: "not_found" }, { status: NOT_FOUND_STATUS });
  },
  async scheduled() {},
} satisfies ExportedHandler<Env>;
