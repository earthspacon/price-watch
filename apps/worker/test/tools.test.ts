import { PRICE_CHECKER_PATH, PRICE_CHECKER_RUNS_PER_DAY, type PriceCheckDto } from "@price-watch/contract";
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { countRows } from "./helpers";
import { BASE, TURNSTILE_TEST_TOKEN } from "./session";
import { LINEN_SHIRT, productJsonUrl, setStoreProduct, setStoreResponse, storeRequests } from "./stores";

const STORE_HOST = "rival.example";
const SHIRT_URL = `https://${STORE_HOST}/products/linen-shirt?variant=1001`;
const RESPONSE_SIZE_CAP_BYTES = 1024 * 1024;

const SHIRT_ON_SALE = {
  ...LINEN_SHIRT,
  variants: [
    {
      ...LINEN_SHIRT.variants[0],
      compare_at_price: "34.99",
    },
    {
      ...LINEN_SHIRT.variants[1],
      compare_at_price: null,
    },
  ],
};

function randomIp() {
  const octets = crypto.getRandomValues(new Uint8Array(3));
  return `203.${octets[0]}.${octets[1]}.${octets[2]}`;
}

async function checkPrice({
  url,
  ip = randomIp(),
  token = TURNSTILE_TEST_TOKEN,
}: {
  url: string;
  ip?: string;
  token?: string | null;
}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: BASE,
    "cf-connecting-ip": ip,
  });
  if (token !== null) {
    headers.set("x-turnstile-token", token);
  }
  return SELF.fetch(`${BASE}${PRICE_CHECKER_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
}

describe("free Shopify price checker", () => {
  it("answers without signing in and shows every variant's price and compare-at price", async () => {
    setStoreProduct({ host: STORE_HOST, handle: "linen-shirt", product: SHIRT_ON_SALE });

    const response = await checkPrice({ url: SHIRT_URL });

    expect(response.status).toBe(200);
    expect(await response.json<PriceCheckDto>()).toEqual({
      status: "ok",
      storeHost: STORE_HOST,
      title: "Linen Shirt",
      variants: [
        {
          id: "1001",
          title: "Blue / M",
          priceCents: 2499,
          compareAtCents: 3499,
        },
        {
          id: "1002",
          title: "White / L",
          priceCents: 2999,
          compareAtCents: null,
        },
      ],
    });
    expect(storeRequests.map((request) => request.url)).toEqual([
      productJsonUrl({ host: STORE_HOST, handle: "linen-shirt" }),
    ]);
  });

  it("does not follow a store's redirect to another address", async () => {
    setStoreProduct({ host: STORE_HOST, handle: "linen-shirt", product: LINEN_SHIRT });

    await checkPrice({ url: SHIRT_URL });

    expect(storeRequests.map((request) => request.redirect)).toEqual(["manual"]);
  });

  it("rejects a request without a bot check token and never contacts the store", async () => {
    setStoreProduct({ host: STORE_HOST, handle: "linen-shirt", product: LINEN_SHIRT });

    const response = await checkPrice({ url: SHIRT_URL, token: null });

    expect(response.status).toBe(403);
    expect(storeRequests).toHaveLength(0);
  });

  it("rejects a request whose bot check token fails verification", async () => {
    const response = await checkPrice({ url: SHIRT_URL, token: "forged-token" });

    expect(response.status).toBe(403);
    expect(storeRequests).toHaveLength(0);
  });

  it.each([
    ["plain http", "http://rival.example/products/linen-shirt"],
    ["a page that is not a product", "https://rival.example/pages/about"],
    ["a collection page", "https://rival.example/collections/shirts"],
    ["a private address", "https://127.0.0.1/products/linen-shirt"],
    ["localhost", "https://shop.localhost/products/linen-shirt"],
    ["another port", "https://rival.example:8443/products/linen-shirt"],
    ["not a link", "linen shirt"],
  ])("rejects %s and never fetches it", async (_label, url) => {
    const response = await checkPrice({ url });

    expect(response.status).toBe(400);
    expect(storeRequests).toHaveLength(0);
  });

  it(`allows ${PRICE_CHECKER_RUNS_PER_DAY} checks per IP a day, then refuses without contacting the store`, async () => {
    setStoreProduct({ host: STORE_HOST, handle: "linen-shirt", product: LINEN_SHIRT });
    const ip = randomIp();

    for (let run = 0; run < PRICE_CHECKER_RUNS_PER_DAY; run += 1) {
      expect((await checkPrice({ url: SHIRT_URL, ip })).status, `run ${run + 1}`).toBe(200);
    }
    const refused = await checkPrice({ url: SHIRT_URL, ip });
    const otherVisitor = await checkPrice({ url: SHIRT_URL });

    expect(refused.status).toBe(429);
    expect(storeRequests).toHaveLength(PRICE_CHECKER_RUNS_PER_DAY + 1);
    expect(otherVisitor.status).toBe(200);
  });

  it("stores nothing but the hashed IP hit", async () => {
    setStoreProduct({ host: STORE_HOST, handle: "linen-shirt", product: LINEN_SHIRT });
    const linksBefore = await countRows({ sql: "SELECT COUNT(*) AS n FROM links", binds: [] });
    const ip = randomIp();

    await checkPrice({ url: SHIRT_URL, ip });

    expect(await countRows({ sql: "SELECT COUNT(*) AS n FROM links", binds: [] })).toBe(linksBefore);
    expect(
      await countRows({ sql: "SELECT COUNT(*) AS n FROM rate_limit_hits WHERE key LIKE ?", binds: [`%${ip}%`] }),
    ).toBe(0);
  });

  it.each([403, 429, 503])("marks a store that answers %i as blocked and shows no price", async (status) => {
    setStoreResponse({ host: STORE_HOST, handle: "linen-shirt", status, body: "<html>Access denied</html>" });

    const response = await checkPrice({ url: SHIRT_URL });

    expect(await response.json<PriceCheckDto>()).toEqual({ status: "blocked", storeHost: STORE_HOST });
  });

  it("says no product data was found when the link is not a Shopify product", async () => {
    const response = await checkPrice({ url: "https://rival.example/products/no-such-thing" });

    expect(await response.json<PriceCheckDto>()).toEqual({ status: "not_found", storeHost: STORE_HOST });
  });

  it("stops reading an answer larger than the size cap", async () => {
    const padding = "x".repeat(RESPONSE_SIZE_CAP_BYTES);
    setStoreResponse({
      host: STORE_HOST,
      handle: "linen-shirt",
      status: 200,
      body: JSON.stringify({ product: { ...LINEN_SHIRT, padding } }),
    });

    const response = await checkPrice({ url: SHIRT_URL });

    expect(await response.json<PriceCheckDto>()).toEqual({ status: "not_found", storeHost: STORE_HOST });
  });
});
