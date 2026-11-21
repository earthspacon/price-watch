import { describe, expect, it } from "vitest";

import notShopifyHtml from "../fixtures/shopify/not-shopify.html?raw";
import {
  addLinks,
  db,
  minutesAfter,
  productUrl,
  readLinks,
  readPricePoints,
  runChecks,
  uniqueEmail,
  updateSubscription,
} from "./helpers";
import { signInAccount } from "./session";
import {
  countStoreRequests,
  LINEN_SHIRT,
  productJsonUrl,
  setStoreProduct,
  setStoreResponse,
  storeRequests,
  withPrices,
} from "./stores";

const RIVAL = "rival.example";
const SHIRT = "linen-shirt";
const SHIRT_JSON_URL = productJsonUrl({ host: RIVAL, handle: SHIRT });
const USER_AGENT = "PriceDawn/1.0 (+https://pricedawn.com)";
const FIRST_RUN = "2030-01-14T15:00:00.000Z";
// The day after FIRST_RUN, past 01:00 UTC, so a link checked on the first run is due again.
const NEXT_DAY_RUN = "2030-01-15T09:00:00.000Z";
const RETRY_DELAYS_MINUTES = [15, 60];
const CHECK_TIMEOUT_MS = 10_000;
const LINKS_PER_RUN = 20;
const LINKS_PER_HOST_PER_RUN = 3;

async function startTracking({ prefix, urls }: { prefix: string; urls: string[] }) {
  const account = await signInAccount({ email: uniqueEmail({ prefix }), plan: "pro", status: "active" });
  const result = await addLinks({ cookie: account.cookie, urls });
  expect(result.added, "links saved").toBe(urls.length);
  return account;
}

async function startTrackingShirt({ prefix }: { prefix: string }) {
  setStoreProduct({ host: RIVAL, handle: SHIRT, product: LINEN_SHIRT });
  const account = await startTracking({ prefix, urls: [productUrl({ host: RIVAL, handle: SHIRT })] });
  await runChecks({ now: FIRST_RUN });
  return account;
}

async function readOnlyLink({ cookie }: { cookie: string }) {
  const links = await readLinks({ cookie });
  expect(links).toHaveLength(1);
  return links[0];
}

function countRequestsPerHost() {
  const counts = new Map<string, number>();
  for (const request of storeRequests) {
    const host = new URL(request.url).host;
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return counts;
}

describe("plan gate", () => {
  it("R7: links of a canceled account are not checked", async () => {
    const otherHost = "other.example";
    setStoreProduct({ host: RIVAL, handle: SHIRT, product: LINEN_SHIRT });
    setStoreProduct({ host: otherHost, handle: SHIRT, product: LINEN_SHIRT });
    await startTracking({ prefix: "live", urls: [productUrl({ host: RIVAL, handle: SHIRT })] });
    const canceled = await startTracking({
      prefix: "canceled",
      urls: [productUrl({ host: otherHost, handle: SHIRT })],
    });
    await updateSubscription({ accountId: canceled.accountId, plan: "pro", status: "canceled" });

    await runChecks({ now: FIRST_RUN });

    expect(countStoreRequests({ url: SHIRT_JSON_URL }), "the live account's link").toBe(1);
    expect(countStoreRequests({ url: productJsonUrl({ host: otherHost, handle: SHIRT }) })).toBe(0);
    expect(await readOnlyLink({ cookie: canceled.cookie })).toMatchObject({ status: "pending", lastCheckedAt: null });
  });

  it("R10: after a downgrade only the oldest links up to the limit are checked", async () => {
    const starterLimit = 100;
    const hosts = Array.from({ length: 50 }, (_, index) => `store-${index}.example`);
    const olderUrls = hosts.flatMap((host) => {
      return [productUrl({ host, handle: "first" }), productUrl({ host, handle: "second" })];
    });
    const newerUrls = hosts.map((host) => productUrl({ host, handle: "third" }));
    const account = await startTracking({ prefix: "downgrade", urls: olderUrls });
    expect((await addLinks({ cookie: account.cookie, urls: newerUrls })).added).toBe(newerUrls.length);
    await updateSubscription({ accountId: account.accountId, plan: "starter", status: "active" });

    // 100 links at 20 a run need 5 runs; the extra runs prove the newer links never become due.
    for (let run = 0; run < 10; run++) {
      await runChecks({ now: FIRST_RUN });
    }

    const fetched = new Set(storeRequests.map((request) => request.url));
    expect(fetched.size).toBe(starterLimit);
    for (const host of hosts) {
      expect(fetched.has(productJsonUrl({ host, handle: "first" }))).toBe(true);
      expect(fetched.has(productJsonUrl({ host, handle: "second" }))).toBe(true);
      expect(fetched.has(productJsonUrl({ host, handle: "third" }))).toBe(false);
    }
    const links = await readLinks({ cookie: account.cookie });
    const newer = links.filter((link) => newerUrls.includes(link.url));
    expect(newer).toHaveLength(newerUrls.length);
    for (const link of newer) {
      expect(link).toMatchObject({ status: "paused", lastCheckedAt: null });
    }
  });
});

describe("first check", () => {
  it("R13: the first check stores the title, price and a first price point", async () => {
    const { cookie, accountId } = await startTrackingShirt({ prefix: "first-check" });

    expect(storeRequests.map((request) => request.url)).toEqual([SHIRT_JSON_URL]);
    expect(await readOnlyLink({ cookie })).toMatchObject({
      storeHost: RIVAL,
      title: "Linen Shirt",
      variantTitle: "Blue / M",
      priceCents: 2499,
      previousPriceCents: null,
      status: "ok",
      failReason: null,
      lastCheckedAt: FIRST_RUN,
    });
    expect(await readPricePoints({ accountId })).toEqual([
      { priceCents: 2499, previousCents: null, recordedAt: FIRST_RUN },
    ]);
  });

  it("R13: a variant link tracks that variant", async () => {
    setStoreProduct({ host: RIVAL, handle: SHIRT, product: LINEN_SHIRT });
    const { cookie, accountId } = await startTracking({
      prefix: "variant",
      urls: [productUrl({ host: RIVAL, handle: SHIRT, variantId: 1002 })],
    });

    await runChecks({ now: FIRST_RUN });

    expect(await readOnlyLink({ cookie })).toMatchObject({
      title: "Linen Shirt",
      variantTitle: "White / L",
      priceCents: 2999,
      status: "ok",
    });
    expect(await readPricePoints({ accountId })).toEqual([
      { priceCents: 2999, previousCents: null, recordedAt: FIRST_RUN },
    ]);
  });

  it("R14: a store without product JSON fails as not_shopify", async () => {
    setStoreResponse({ host: "html.example", handle: SHIRT, status: 200, body: notShopifyHtml });
    setStoreResponse({
      host: "plain.example",
      handle: SHIRT,
      status: 200,
      body: JSON.stringify({ product: { id: 7 } }),
    });
    const urls = ["html.example", "missing.example", "plain.example"].map((host) => {
      return productUrl({ host, handle: SHIRT });
    });
    const { cookie, accountId } = await startTracking({ prefix: "not-shopify", urls });

    await runChecks({ now: FIRST_RUN });

    expect(storeRequests).toHaveLength(urls.length);
    const links = await readLinks({ cookie });
    expect(links).toHaveLength(urls.length);
    for (const link of links) {
      expect(link).toMatchObject({ status: "failed", failReason: "not_shopify", priceCents: null, title: null });
    }
    expect(await readPricePoints({ accountId })).toEqual([]);
  });
});

describe("daily check", () => {
  it("R15: an unchanged price adds no price point", async () => {
    setStoreProduct({ host: RIVAL, handle: SHIRT, product: LINEN_SHIRT });
    const { cookie, accountId } = await startTracking({
      prefix: "unchanged",
      urls: [productUrl({ host: RIVAL, handle: SHIRT })],
    });
    await db.prepare("UPDATE accounts SET time_zone = 'America/New_York' WHERE id = ?").bind(accountId).run();
    await runChecks({ now: FIRST_RUN });

    // 01:00 in New York on January 15 is 06:00 UTC.
    await runChecks({ now: "2030-01-15T05:59:00.000Z" });
    expect(countStoreRequests({ url: SHIRT_JSON_URL }), "not due before 01:00 local").toBe(1);
    await runChecks({ now: "2030-01-15T06:05:00.000Z" });

    expect(countStoreRequests({ url: SHIRT_JSON_URL })).toBe(2);
    expect(await readOnlyLink({ cookie })).toMatchObject({
      status: "ok",
      priceCents: 2499,
      previousPriceCents: null,
      lastCheckedAt: "2030-01-15T06:05:00.000Z",
    });
    expect(await readPricePoints({ accountId })).toHaveLength(1);
  });

  it("R15: a changed price adds a price point with the previous price", async () => {
    const { cookie, accountId } = await startTrackingShirt({ prefix: "changed" });
    setStoreProduct({
      host: RIVAL,
      handle: SHIRT,
      product: withPrices({ product: LINEN_SHIRT, prices: { 1001: "19.99" } }),
    });

    await runChecks({ now: NEXT_DAY_RUN });

    expect(await readOnlyLink({ cookie })).toMatchObject({
      status: "ok",
      priceCents: 1999,
      previousPriceCents: 2499,
      changedAt: NEXT_DAY_RUN,
      lastCheckedAt: NEXT_DAY_RUN,
    });
    expect(await readPricePoints({ accountId })).toEqual([
      { priceCents: 2499, previousCents: null, recordedAt: FIRST_RUN },
      { priceCents: 1999, previousCents: 2499, recordedAt: NEXT_DAY_RUN },
    ]);
  });
});

describe("failing stores", () => {
  it("R16: a throttled check is retried after 15 and 60 minutes", async () => {
    const { cookie, accountId } = await startTrackingShirt({ prefix: "throttled" });
    const firstRetry = minutesAfter({ time: NEXT_DAY_RUN, minutes: RETRY_DELAYS_MINUTES[0] });
    const secondRetry = minutesAfter({ time: firstRetry, minutes: RETRY_DELAYS_MINUTES[1] });

    setStoreResponse({ host: RIVAL, handle: SHIRT, status: 429, body: "Too Many Requests" });
    await runChecks({ now: NEXT_DAY_RUN });
    expect(countStoreRequests({ url: SHIRT_JSON_URL })).toBe(2);
    expect(await readOnlyLink({ cookie })).toMatchObject({ status: "ok", failReason: null, priceCents: 2499 });

    await runChecks({ now: minutesAfter({ time: firstRetry, minutes: -1 }) });
    expect(countStoreRequests({ url: SHIRT_JSON_URL }), "not retried before 15 minutes").toBe(2);
    setStoreResponse({ host: RIVAL, handle: SHIRT, status: 403, body: "Forbidden" });
    await runChecks({ now: firstRetry });
    expect(countStoreRequests({ url: SHIRT_JSON_URL })).toBe(3);

    await runChecks({ now: minutesAfter({ time: secondRetry, minutes: -1 }) });
    expect(countStoreRequests({ url: SHIRT_JSON_URL }), "not retried before 60 more minutes").toBe(3);
    setStoreProduct({ host: RIVAL, handle: SHIRT, product: LINEN_SHIRT });
    await runChecks({ now: secondRetry });

    expect(countStoreRequests({ url: SHIRT_JSON_URL })).toBe(4);
    expect(await readOnlyLink({ cookie })).toMatchObject({
      status: "ok",
      failReason: null,
      priceCents: 2499,
      lastCheckedAt: secondRetry,
    });
    expect(await readPricePoints({ accountId })).toHaveLength(1);
  });

  it(
    "R16: the third failed attempt marks the link blocked and keeps its price",
    async () => {
      const { cookie, accountId } = await startTrackingShirt({ prefix: "blocked" });
      const firstRetry = minutesAfter({ time: NEXT_DAY_RUN, minutes: RETRY_DELAYS_MINUTES[0] });
      const secondRetry = minutesAfter({ time: firstRetry, minutes: RETRY_DELAYS_MINUTES[1] });

      setStoreResponse({ host: RIVAL, handle: SHIRT, status: 503, body: "Service Unavailable" });
      await runChecks({ now: NEXT_DAY_RUN });
      // A good answer that comes after the timeout must still count as a failed attempt.
      setStoreResponse({
        host: RIVAL,
        handle: SHIRT,
        status: 200,
        body: JSON.stringify({ product: withPrices({ product: LINEN_SHIRT, prices: { 1001: "9.99" } }) }),
        delayMs: CHECK_TIMEOUT_MS + 1000,
      });
      await runChecks({ now: firstRetry });
      setStoreResponse({ host: RIVAL, handle: SHIRT, status: 429, body: "Too Many Requests" });
      await runChecks({ now: secondRetry });

      expect(await readOnlyLink({ cookie })).toMatchObject({
        status: "failed",
        failReason: "blocked",
        priceCents: 2499,
      });
      expect(await readPricePoints({ accountId })).toHaveLength(1);

      await runChecks({ now: minutesAfter({ time: secondRetry, minutes: RETRY_DELAYS_MINUTES[1] }) });
      await runChecks({ now: "2030-01-15T23:59:00.000Z" });
      expect(countStoreRequests({ url: SHIRT_JSON_URL }), "three attempts on the day, then none").toBe(4);
    },
    3 * CHECK_TIMEOUT_MS,
  );

  it("R17: a vanished product fails as unavailable", async () => {
    const withoutWhite = { ...LINEN_SHIRT, variants: LINEN_SHIRT.variants.filter((variant) => variant.id !== 1002) };
    for (const handle of [SHIRT, "wool-coat", "canvas-cap"]) {
      setStoreProduct({ host: RIVAL, handle, product: LINEN_SHIRT });
    }
    const { cookie, accountId } = await startTracking({
      prefix: "vanished",
      urls: [
        productUrl({ host: RIVAL, handle: SHIRT }),
        productUrl({ host: RIVAL, handle: "wool-coat" }),
        productUrl({ host: RIVAL, handle: "canvas-cap", variantId: 1002 }),
      ],
    });
    await runChecks({ now: FIRST_RUN });
    setStoreResponse({ host: RIVAL, handle: SHIRT, status: 404, body: "Not Found" });
    setStoreResponse({ host: RIVAL, handle: "wool-coat", status: 200, body: notShopifyHtml });
    setStoreProduct({ host: RIVAL, handle: "canvas-cap", product: withoutWhite });

    await runChecks({ now: NEXT_DAY_RUN });

    const links = await readLinks({ cookie });
    expect(links.map((link) => link.priceCents).sort()).toEqual([2499, 2499, 2999]);
    for (const link of links) {
      expect(link).toMatchObject({ status: "failed", failReason: "unavailable", lastCheckedAt: NEXT_DAY_RUN });
    }
    expect(await readPricePoints({ accountId })).toHaveLength(links.length);
  });

  it("R17: a failed link that answers again is ok", async () => {
    const { cookie, accountId } = await startTrackingShirt({ prefix: "back" });
    setStoreResponse({ host: RIVAL, handle: SHIRT, status: 404, body: "Not Found" });
    await runChecks({ now: NEXT_DAY_RUN });
    expect(await readOnlyLink({ cookie })).toMatchObject({ status: "failed", failReason: "unavailable" });
    setStoreProduct({
      host: RIVAL,
      handle: SHIRT,
      product: withPrices({ product: LINEN_SHIRT, prices: { 1001: "21.99" } }),
    });

    await runChecks({ now: "2030-01-16T09:00:00.000Z" });

    expect(await readOnlyLink({ cookie })).toMatchObject({
      status: "ok",
      failReason: null,
      priceCents: 2199,
      previousPriceCents: 2499,
    });
    expect(await readPricePoints({ accountId })).toHaveLength(2);
  });
});

describe("pacing", () => {
  it("R18: one run checks at most 20 links and 3 per store", async () => {
    const busyStore = Array.from({ length: 100 }, (_, index) => productUrl({ host: RIVAL, handle: `item-${index}` }));
    const otherStores = Array.from({ length: 100 }, (_, index) => {
      return productUrl({ host: `shop-${index % 10}.example`, handle: `item-${index}` });
    });
    await startTracking({ prefix: "pacing", urls: [...busyStore, ...otherStores] });

    await runChecks({ now: FIRST_RUN });

    expect(storeRequests).toHaveLength(LINKS_PER_RUN);
    const perHost = countRequestsPerHost();
    expect(Math.max(...perHost.values())).toBeLessThanOrEqual(LINKS_PER_HOST_PER_RUN);
    expect(perHost.get(RIVAL)).toBeGreaterThan(0);
    for (const request of storeRequests) {
      expect(request.userAgent).toBe(USER_AGENT);
    }
  });

  it("R18: an overlapping run skips links another run holds", async () => {
    const hosts = Array.from({ length: 10 }, (_, index) => `overlap-${index}.example`);
    const urls = hosts.flatMap((host) => {
      return ["first", "second", "third"].map((handle) => {
        // Slow answers keep the first run's links leased while the second run picks its own.
        setStoreResponse({
          host,
          handle,
          status: 200,
          body: JSON.stringify({ product: LINEN_SHIRT }),
          delayMs: 300,
        });
        return productUrl({ host, handle });
      });
    });
    await startTracking({ prefix: "overlap", urls });

    await Promise.all([runChecks({ now: FIRST_RUN }), runChecks({ now: FIRST_RUN })]);

    const fetched = storeRequests.map((request) => request.url);
    expect(new Set(fetched).size, "each link fetched once").toBe(fetched.length);
    expect(fetched).toHaveLength(urls.length);
  });
});
