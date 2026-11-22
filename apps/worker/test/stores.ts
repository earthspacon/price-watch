import productJson from "../fixtures/shopify/product.json?raw";

export type ShopifyVariant = { id: number; title: string; price: string; sku: string };

export type ShopifyProduct = { id: number; title: string; handle: string; variants: ShopifyVariant[] };

type StoreReply = { status: number; body: string; delayMs: number };

export const LINEN_SHIRT: ShopifyProduct = JSON.parse(productJson).product;

export const storeRequests: Array<{ url: string; userAgent: string | null; redirect: string }> = [];

const PRODUCT_JSON_URL = /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.example)\/products\/([^/?#]+)\.json$/;
const replies = new Map<string, StoreReply>();

// Every https://*.example/products/<handle>.json request is answered from the per-test table; a handle
// without a reply gets the 404 a Shopify store gives for an unknown product.
export function installFakeStores() {
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const match = PRODUCT_JSON_URL.exec(request.url);

    if (!match) {
      return realFetch(input, init);
    }
    storeRequests.push({
      url: request.url,
      userAgent: request.headers.get("user-agent"),
      redirect: request.redirect,
    });
    const reply = replies.get(storeKey({ host: match[1], handle: match[2] }));

    if (!reply) {
      return new Response("Not Found", { status: 404, headers: { "content-type": "text/html" } });
    }
    await waitUnlessAborted({ delayMs: reply.delayMs, signal: request.signal });
    return new Response(reply.body, {
      status: reply.status,
      headers: { "content-type": guessContentType(reply.body) },
    });
  };
}

export function resetFakeStores() {
  replies.clear();
  storeRequests.length = 0;
}

export function setStoreProduct({ host, handle, product }: { host: string; handle: string; product: ShopifyProduct }) {
  setStoreResponse({
    host,
    handle,
    status: 200,
    body: JSON.stringify({ product }),
  });
}

export function setStoreResponse({
  host,
  handle,
  status,
  body,
  delayMs = 0,
}: {
  host: string;
  handle: string;
  status: number;
  body: string;
  delayMs?: number;
}) {
  replies.set(storeKey({ host, handle }), {
    status,
    body,
    delayMs,
  });
}

export function withPrices({ product, prices }: { product: ShopifyProduct; prices: Record<number, string> }) {
  return {
    ...product,
    variants: product.variants.map((variant) => {
      return { ...variant, price: prices[variant.id] ?? variant.price };
    }),
  };
}

export function productJsonUrl({ host, handle }: { host: string; handle: string }) {
  return `https://${host}/products/${handle}.json`;
}

export function countStoreRequests({ url }: { url: string }) {
  return storeRequests.filter((request) => request.url === url).length;
}

function storeKey({ host, handle }: { host: string; handle: string }) {
  return `${host}/${handle}`;
}

function guessContentType(body: string) {
  return body.trimStart().startsWith("{") ? "application/json" : "text/html";
}

function waitUnlessAborted({ delayMs, signal }: { delayMs: number; signal: AbortSignal }) {
  if (delayMs === 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}
