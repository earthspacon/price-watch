import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PADDLE_TEST_PRICES } from "./config";
import { launchBrowser, openAccount } from "./helpers";

type CheckoutOptions = {
  items: Array<{ priceId: string; quantity: number }>;
  customer: { email: string };
  customData: { account_id: string };
};

const PADDLE_CDN = "https://cdn.paddle.com/**";
const CHECKOUT_TIMEOUT_MS = 10_000;

// Paddle.js stand-in: the real overlay needs a live Paddle account, so the test only records what the app asks it to open.
const FAKE_PADDLE_JS = `
window.Paddle = {
  Environment: { set: function () {} },
  Initialize: function () {},
  Checkout: {
    open: function (options) {
      window.recordPaddleCheckout(JSON.stringify(options));
    },
  },
};
`;

async function stubPaddle({ page }: { page: Page }) {
  const checkouts: CheckoutOptions[] = [];
  await page.exposeFunction("recordPaddleCheckout", (options: string) => {
    checkouts.push(JSON.parse(options) as CheckoutOptions);
  });
  await page.route(PADDLE_CDN, (route) => {
    return route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_PADDLE_JS });
  });
  return checkouts;
}

describe("plan picker", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("R5: an account without a plan sees both plans and a disabled paste box", async () => {
    const { page } = await openAccount({ browser });

    await page.getByText("Pick a plan to start tracking").waitFor();
    const starter = page.getByRole("button", { name: /Starter/ });
    const pro = page.getByRole("button", { name: /Pro/ });

    expect(await starter.isVisible()).toBe(true);
    expect(await pro.isVisible()).toBe(true);
    expect(await page.getByText("$19").first().isVisible()).toBe(true);
    expect(await page.getByText("$49").first().isVisible()).toBe(true);
    expect(await page.getByRole("textbox", { name: /product links/i }).isDisabled()).toBe(true);
  });

  it("R5: choosing Starter opens Paddle checkout with the Starter price", async () => {
    const { page, email, accountId } = await openAccount({ browser });
    const checkouts = await stubPaddle({ page });

    await page.getByRole("button", { name: /Starter/ }).click();
    await expect.poll(() => checkouts.length, { timeout: CHECKOUT_TIMEOUT_MS }).toBe(1);

    expect(checkouts[0]).toMatchObject({
      items: [{ priceId: PADDLE_TEST_PRICES.starter, quantity: 1 }],
      customer: { email },
      customData: { account_id: accountId },
    });
  });
});
