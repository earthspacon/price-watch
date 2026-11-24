import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addLinksByApi,
  launchBrowser,
  MOBILE,
  DESKTOP,
  openAccount,
  openSession,
  productUrl,
  uniqueStoreHost,
} from "./helpers";

const MIN_TARGET_PX = 44;
const MAX_PUBLIC_HEADER_PX = 64;
const MAX_HERO_LINES = 4;
const ROW_TOLERANCE_PX = 4;
const PUBLIC_PAGES = ["/", "/pricing"];

type Box = { top: number; centre: number; height: number; text: string };

async function headerBoxes({ page }: { page: Page }) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const rect = header?.getBoundingClientRect();
    const children = Array.from(header?.querySelectorAll("a, button") ?? [])
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          centre: box.top + box.height / 2,
          height: box.height,
          text: (element.textContent ?? "").trim() || (element.getAttribute("aria-label") ?? ""),
        };
      })
      .filter((box) => box.height > 0);
    return { height: rect?.height ?? 0, children } as { height: number; children: Box[] };
  });
}

// Everything a finger has to hit: visible buttons, links and inputs smaller than the minimum tap size.
async function smallTargets({ page }: { page: Page }) {
  return page.evaluate((min) => {
    const small: string[] = [];
    for (const element of Array.from(document.querySelectorAll("a, button, input, select, textarea, [role=button]"))) {
      const box = element.getBoundingClientRect();
      // Links inside a sentence are exempt (WCAG 2.5.8); flex/grid items are blockified, so they still count.
      if (box.width === 0 || box.height === 0 || getComputedStyle(element).display === "inline") {
        continue;
      }
      if (box.height < min || box.width < min) {
        const label = (element.textContent ?? "").trim() || element.getAttribute("aria-label") || "";
        small.push(
          `${element.tagName.toLowerCase()}:${label.slice(0, 24)}:${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }
    return small;
  }, MIN_TARGET_PX);
}

// Where the header and hero buttons sit; the session check must not move them.
async function ctaBoxes({ page }: { page: Page }) {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        'header nav a, main section:first-child a[href="/sign-in"], main section:first-child a[href="/app"]',
      ),
    ).map((element) => {
      const box = element.getBoundingClientRect();
      return [Math.round(box.left), Math.round(box.width)];
    });
  });
}

async function expectTouchTargets({ page }: { page: Page }) {
  expect(await smallTargets({ page })).toEqual([]);
}

describe("layout", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  for (const path of PUBLIC_PAGES) {
    it(`public header is one row at 390 on ${path}`, async () => {
      const { page } = await openSession({ browser, viewport: MOBILE });

      await page.goto(path);
      const header = await headerBoxes({ page });
      const tops = header.children.map((child) => child.centre);

      expect(header.height).toBeLessThanOrEqual(MAX_PUBLIC_HEADER_PX);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
    });

    it(`every nav item stays reachable at 390 on ${path}`, async () => {
      const { page } = await openSession({ browser, viewport: MOBILE });

      await page.goto(path);
      for (const href of ["/pricing", "/prisync-alternative", "/track-shopify-competitor-prices"]) {
        expect(await page.locator(`a[href="${href}"]:visible`).count()).toBeGreaterThan(0);
      }
    });
  }

  it("the full nav is visible at 1440", async () => {
    const { page } = await openSession({ browser, viewport: DESKTOP });

    await page.goto("/");
    const header = await headerBoxes({ page });
    const labels = header.children.map((child) => child.text);

    expect(labels).toEqual(expect.arrayContaining(["Pricing", "Compare", "Guide", "Sign in"]));
    const centres = header.children.map((child) => child.centre);

    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
  });

  it("hero headline is at most 4 lines at 390", async () => {
    const { page } = await openSession({ browser, viewport: MOBILE });

    await page.goto("/");
    const lines = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      if (!heading) {
        return Number.POSITIVE_INFINITY;
      }
      return heading.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(heading).lineHeight);
    });

    expect(Math.round(lines)).toBeLessThanOrEqual(MAX_HERO_LINES);
  });

  for (const path of [
    "/",
    "/pricing",
    "/prisync-alternative",
    "/track-shopify-competitor-prices",
    "/tools/shopify-price-checker",
    "/terms",
    "/sign-in",
  ]) {
    it(`touch targets are at least 44 px on ${path} at 390`, async () => {
      const { page } = await openSession({ browser, viewport: MOBILE });

      await page.goto(path);

      await expectTouchTargets({ page });
    });
  }

  it("touch targets are at least 44 px on /app at 390", async () => {
    const { page } = await openAccount({ browser, plan: "paid", viewport: MOBILE });
    const host = uniqueStoreHost();

    await addLinksByApi({ page, urls: [productUrl({ host, handle: "linen-shirt-1" })] });
    await page.goto("/app");
    await page
      .getByRole("link", { name: /linen|rival/i })
      .first()
      .waitFor();

    await expectTouchTargets({ page });
  });

  it("the app header fits inside 390 with every control on screen", async () => {
    const { page } = await openAccount({ browser, viewport: MOBILE });

    await page.getByText("Start the plan to begin tracking").waitFor();
    const overflow = await page.evaluate((width) => {
      return Array.from(document.querySelectorAll("header a, header button"))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { label: (element.textContent ?? "").trim() || element.getAttribute("aria-label"), right: box.right };
        })
        .filter((box) => box.right > width);
    }, MOBILE.width);

    expect(overflow).toEqual([]);
  });

  for (const viewport of [MOBILE, DESKTOP]) {
    it(`a signed-in visitor gets Open dashboard in the header and hero at ${viewport.width}, with no shift`, async () => {
      const visitor = await openSession({ browser, viewport });
      await visitor.page.goto("/");
      const signedOut = await ctaBoxes({ page: visitor.page });
      const { page } = await openAccount({ browser, viewport });

      await page.goto("/");
      const header = page.locator("header");
      await header.getByRole("link", { name: "Open dashboard" }).waitFor();
      const signedIn = await ctaBoxes({ page });

      expect(await header.getByRole("link", { name: "Open dashboard" }).getAttribute("href")).toBe("/app");
      expect(await page.locator("main").getByRole("link", { name: "Open dashboard" }).getAttribute("href")).toBe(
        "/app",
      );
      expect(await header.getByRole("link", { name: "Sign in" }).count()).toBe(0);
      expect(signedIn).toEqual(signedOut);
    });
  }

  for (const theme of ["dark", "light"]) {
    it(`the Turnstile widget renders with the ${theme} theme on a ${theme} site`, async () => {
      const { page } = await openSession({ browser, viewport: MOBILE });
      await page.addInitScript((value) => {
        localStorage.theme = value;
        (window as unknown as { turnstile: unknown }).turnstile = {
          render: (_container: unknown, options: Record<string, unknown>) => {
            (window as unknown as { renderOptions: unknown }).renderOptions = options;
            return "stub-widget";
          },
          remove: () => undefined,
        };
      }, theme);

      await page.goto("/sign-in");
      await page.waitForFunction(() => (window as unknown as { renderOptions?: unknown }).renderOptions !== undefined);
      const options = await page.evaluate(
        () => (window as unknown as { renderOptions: { theme?: string } }).renderOptions,
      );

      expect(options.theme).toBe(theme);
    });
  }
});
