import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DESKTOP, launchBrowser, MOBILE, openAccount, openSession } from "./helpers";

const SHOTS_DIR = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../../../.agents/reports/shots");
const PAGES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "prisync-alternative", path: "/prisync-alternative" },
  { name: "track-shopify-competitor-prices", path: "/track-shopify-competitor-prices" },
  { name: "shopify-price-checker", path: "/tools/shopify-price-checker" },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "refunds", path: "/refunds" },
  { name: "sign-in", path: "/sign-in" },
];
const VIEWPORTS = [
  { label: "1440", size: DESKTOP },
  { label: "390", size: MOBILE },
];
const SETTLE_MS = 1500;
const consoleReport: Array<{ shot: string; errors: number }> = [];

describe("screenshots", () => {
  let browser: Browser;

  beforeAll(async () => {
    mkdirSync(SHOTS_DIR, { recursive: true });
    browser = await launchBrowser();
  });

  afterAll(async () => {
    console.log(consoleReport.map(({ shot, errors }) => `${shot}: ${errors} console errors`).join("\n"));
    await browser.close();
  });

  it("public pages at 1440 and 390 have no console errors", async () => {
    for (const { label, size } of VIEWPORTS) {
      const session = await openSession({ browser, viewport: size });
      for (const page of PAGES) {
        session.consoleErrors.length = 0;
        await session.page.goto(page.path);
        await session.page.waitForLoadState("load");
        await session.page.waitForTimeout(SETTLE_MS);
        await session.page.screenshot({ path: path.join(SHOTS_DIR, `${page.name}-${label}.png`), fullPage: true });
        consoleReport.push({ shot: `${page.name}-${label}`, errors: session.consoleErrors.length });
        expect(session.consoleErrors, `${page.name} at ${label}`).toEqual([]);
      }
      await session.context.close();
    }
  });

  it("the dashboard empty state at 1440 and 390", async () => {
    for (const { label, size } of VIEWPORTS) {
      const { page, context } = await openAccount({ browser, viewport: size });
      await page.getByText("Start the plan to begin tracking").waitFor();
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: path.join(SHOTS_DIR, `dashboard-empty-${label}.png`), fullPage: true });
      await context.close();
      const paid = await openAccount({ browser, plan: "paid", viewport: size });
      await paid.page.waitForLoadState("networkidle");
      await paid.page.waitForTimeout(SETTLE_MS);
      await paid.page.screenshot({ path: path.join(SHOTS_DIR, `dashboard-paid-empty-${label}.png`), fullPage: true });
      await paid.context.close();
    }
  });
});
