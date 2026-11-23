import { readFileSync } from "node:fs";

import { EXPORT_CSV_COLUMNS, PAID_PLAN, type MeDto } from "@price-watch/contract";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LINEN_SHIRT, setFakeProduct, withVariantPrice } from "./fake-store";
import {
  addLinksByApi,
  apiJson,
  failRequests,
  holdRequests,
  launchBrowser,
  LINKS_PATH,
  MOBILE,
  openAccount,
  productUrl,
  runChecks,
  uniqueStoreHost,
} from "./helpers";

const LINKS_REQUEST = "**/api/links";
const BLUE_M = LINEN_SHIRT.variants[0];
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_STATE = "No links yet. Paste product links from competitor Shopify stores.";
const SAVE_ERROR = "Couldn't add the links. Try again.";
const CSV_FILE_NAME = "pricedawn-history.csv";

function pasteBox({ page }: { page: Page }) {
  return page.getByRole("textbox", { name: /product links/i });
}

function addButton({ page }: { page: Page }) {
  return page.getByRole("button", { name: /^Add links$|^Adding…$/ });
}

function linkRows({ page, host }: { page: Page; host: string }) {
  return page.getByRole("row").filter({ hasText: host });
}

function shirtUrls({ host, count }: { host: string; count: number }) {
  return Array.from({ length: count }, (_, index) => {
    return productUrl({ host, handle: `linen-shirt-${index + 1}` });
  });
}

async function pasteLinks({ page, urls }: { page: Page; urls: string[] }) {
  await pasteBox({ page }).fill(urls.join("\n"));
  await addButton({ page }).click();
}

describe("links page", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("R9: pasted links appear as checking", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();

    await pasteLinks({ page, urls: shirtUrls({ host, count: 3 }) });
    await page.getByText("3 links added").waitFor();
    const rows = linkRows({ page, host });

    expect(await rows.count()).toBe(3);
    expect(await rows.filter({ hasText: "Checking…" }).count()).toBe(3);
  });

  it("R9: skipped lines are listed with their reason", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();
    const url = productUrl({ host, handle: "linen-shirt" });

    await pasteLinks({ page, urls: [url, "not a link at all", url] });
    await page.getByText("1 added, 2 skipped").waitFor();

    expect(await page.getByText("Not a valid link").isVisible()).toBe(true);
    expect(await page.getByText("Already tracked").isVisible()).toBe(true);
    expect(await linkRows({ page, host }).count()).toBe(1);
  });

  it("R9: the add button is disabled while the box is empty", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });

    await pasteBox({ page }).waitFor();
    const isDisabledWhenEmpty = await addButton({ page }).isDisabled();
    await pasteBox({ page }).fill(productUrl({ host: uniqueStoreHost(), handle: "linen-shirt" }));

    expect(isDisabledWhenEmpty).toBe(true);
    expect(await addButton({ page }).isEnabled()).toBe(true);
  });

  it("R9: the add button is disabled while links are saved", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();
    const request = await holdRequests({ page, url: LINKS_REQUEST, method: "POST" });

    await pasteLinks({ page, urls: shirtUrls({ host, count: 1 }) });
    const adding = page.getByRole("button", { name: "Adding…" });
    await adding.waitFor();
    const isDisabledWhileSaving = await adding.isDisabled();
    await request.release();
    await page.getByText("1 link added").waitFor();

    expect(isDisabledWhileSaving).toBe(true);
  });

  it("R9: a failed save keeps the pasted text and shows an error", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const urls = shirtUrls({ host: uniqueStoreHost(), count: 2 });
    await failRequests({ page, url: LINKS_REQUEST, method: "POST" });

    await pasteLinks({ page, urls });
    await page.getByText(SAVE_ERROR).waitFor();

    expect(await pasteBox({ page }).inputValue()).toBe(urls.join("\n"));
  });

  it("R10: at the limit the paste box is disabled with the remove hint", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();

    await pasteBox({ page }).waitFor();
    await addLinksByApi({ page, urls: shirtUrls({ host, count: PAID_PLAN.linkLimit }) });
    await page.reload();
    await page.getByText("500 of 500 links. Remove a link to add another.").waitFor();

    expect(await pasteBox({ page }).isDisabled()).toBe(true);
  });

  it("R11: a removed link leaves the list", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();
    const [kept, removed] = shirtUrls({ host, count: 2 });

    await pasteBox({ page }).waitFor();
    await addLinksByApi({ page, urls: [kept, removed] });
    await page.reload();
    await linkRows({ page, host }).nth(1).waitFor();
    await linkRows({ page, host }).filter({ hasText: "linen-shirt-2" }).getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect.poll(() => linkRows({ page, host }).count()).toBe(1);
    const me = await apiJson<MeDto>({ page, path: "/api/me" });

    expect(await linkRows({ page, host }).filter({ hasText: "linen-shirt-1" }).count()).toBe(1);
    expect(me.body.linkCount).toBe(1);
  });

  it("R12: the list shows a loader until links arrive", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const request = await holdRequests({ page, url: LINKS_REQUEST, method: "GET" });

    await page.reload();
    await page.getByText("Loading…").waitFor();
    await request.release();
    await page.getByText(EMPTY_STATE).waitFor();

    expect(await page.getByText("Loading…").count()).toBe(0);
  });

  it("R12: an account with no links sees the empty state", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });

    await page.getByText(EMPTY_STATE).waitFor();

    expect(await pasteBox({ page }).isEnabled()).toBe(true);
  });

  it("R12: a failed load shows the error with try again", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    await failRequests({ page, url: LINKS_REQUEST, method: "GET" });

    await page.reload();
    const tryAgain = page.getByRole("button", { name: "Try again" });
    await tryAgain.waitFor();
    await page.unroute(LINKS_REQUEST);
    await tryAgain.click();
    await page.getByText(EMPTY_STATE).waitFor();

    expect(await tryAgain.count()).toBe(0);
  });

  it("R12: a changed link shows old and new price", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();
    const now = Date.now();

    await pasteBox({ page }).waitFor();
    await addLinksByApi({
      page,
      urls: [productUrl({ host, handle: LINEN_SHIRT.handle, variantId: BLUE_M.id })],
    });
    await runChecks({ now: new Date(now) });
    await setFakeProduct({
      host,
      handle: LINEN_SHIRT.handle,
      product: withVariantPrice({ product: LINEN_SHIRT, variantId: BLUE_M.id, price: "19.99" }),
    });
    await runChecks({ now: new Date(now + 2 * DAY_MS) });
    await page.reload();
    const row = linkRows({ page, host });
    await row.getByText("24.99 → 19.99 (-5.00, -20.0%)").waitFor();

    expect(await row.getByText(LINEN_SHIRT.title).isVisible()).toBe(true);
    expect(await row.getByText(BLUE_M.title).isVisible()).toBe(true);
    expect(await row.getByText("Checking…").count()).toBe(0);
  });

  it("R12: on a phone each link is a card without horizontal scroll", async () => {
    const { page } = await openAccount({ browser, plan: "paid", viewport: MOBILE });
    const host = uniqueStoreHost();

    await pasteBox({ page }).waitFor();
    await addLinksByApi({ page, urls: shirtUrls({ host, count: 2 }) });
    await page.reload();
    const cards = page.getByRole("listitem").filter({ hasText: host });
    await cards.nth(1).waitFor();
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });

    expect(await cards.count()).toBe(2);
    expect(await page.getByRole("table").count()).toBe(0);
    expect(overflow).toBe(0);
  });

  it("R23: the header names the digest time and zone", async () => {
    const timeZone = "Asia/Tashkent";
    const { page } = await openAccount({ browser, plan: "paid", timezoneId: timeZone });

    await page.getByText(`Daily email at 7:00 (${timeZone})`).waitFor();
    const me = await apiJson<MeDto>({ page, path: "/api/me" });

    expect(me.body.timeZone).toBe(timeZone);
  });

  it("R24: export downloads a csv", async () => {
    const { page } = await openAccount({ browser, plan: "paid" });
    const host = uniqueStoreHost();

    await pasteBox({ page }).waitFor();
    await addLinksByApi({ page, urls: [productUrl({ host, handle: LINEN_SHIRT.handle })] });
    await runChecks({ now: new Date() });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Export CSV" })
        .or(page.getByRole("link", { name: "Export CSV" }))
        .click(),
    ]);
    const lines = readFileSync(await download.path(), "utf8")
      .trim()
      .split(/\r?\n/);

    expect(download.suggestedFilename()).toBe(CSV_FILE_NAME);
    expect(lines[0]).toBe(EXPORT_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(host);
  });
});
