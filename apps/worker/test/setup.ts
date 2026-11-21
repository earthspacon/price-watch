import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

import { installFakeStores, resetFakeStores } from "./stores";
import { installFakeSiteverify } from "./turnstile";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
installFakeSiteverify();
installFakeStores();

// A check run takes due links of every account, so links left by an earlier test would take this test's slots.
beforeEach(async () => {
  resetFakeStores();
  await env.DB.prepare("DELETE FROM links").run();
});
