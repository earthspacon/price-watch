import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: process.env.SHOTS ? ["e2e/*.shots.ts"] : ["e2e/**/*.e2e.ts"],
    globalSetup: ["e2e/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
