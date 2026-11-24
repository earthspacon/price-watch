import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.ts",
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            DEV_ROUTES: "1",
            BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-chars",
            PADDLE_API_KEY: "pdl_sdbx_apikey_test",
            PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test_secret",
            PADDLE_PRICE: "pri_paid_test",
            PADDLE_PRICE_YEARLY: "pri_paid_yearly_test",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
