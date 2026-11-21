import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

import { FAKE_STORE_URL } from "./config";

export type ShopifyVariant = { id: number; title: string; price: string; sku: string };

export type ShopifyProduct = { id: number; title: string; handle: string; variants: ShopifyVariant[] };

export type RunningFakeStore = {
  stop: () => Promise<void>;
};

const FIXTURE_FILE = path.resolve(import.meta.dirname, "../../worker/fixtures/shopify/product.json");
const PRODUCT_PATH = /^\/([a-z0-9.-]+)\/products\/([^/?#]+)\.json$/;

export const LINEN_SHIRT: ShopifyProduct = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")).product;

// Stands in for every Shopify store while the Worker runs with DEV_STORE_ORIGIN pointing here:
// GET /<host>/products/<handle>.json answers like the store would, PUT on the same path swaps the product.
// A product nobody has set yet is the Linen Shirt fixture under the requested handle.
export async function startFakeStore({ port }: { port: number }): Promise<RunningFakeStore> {
  const products = new Map<string, ShopifyProduct>();
  const server = createServer((request, response) => {
    handleStoreRequest({ request, response, products }).catch(() => {
      response.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
  return {
    stop: () => {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

export async function setFakeProduct({
  host,
  handle,
  product,
}: {
  host: string;
  handle: string;
  product: ShopifyProduct;
}) {
  const response = await fetch(`${FAKE_STORE_URL}/${host}/products/${handle}.json`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product }),
  });
  if (!response.ok) {
    throw new Error(`fake store refused the product: ${response.status}`);
  }
}

export function withVariantPrice({
  product,
  variantId,
  price,
}: {
  product: ShopifyProduct;
  variantId: number;
  price: string;
}): ShopifyProduct {
  return {
    ...product,
    variants: product.variants.map((variant) => {
      return variant.id === variantId ? { ...variant, price } : variant;
    }),
  };
}

async function handleStoreRequest({
  request,
  response,
  products,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  products: Map<string, ShopifyProduct>;
}) {
  const match = PRODUCT_PATH.exec(request.url ?? "");
  if (!match) {
    response.writeHead(404, { "content-type": "text/html" }).end("<h1>Not Found</h1>");
    return;
  }
  const [, host, handle] = match;
  const key = `${host}/${handle}`;

  if (request.method === "PUT") {
    const { product } = JSON.parse(await readBody(request)) as { product: ShopifyProduct };
    products.set(key, product);
    response.writeHead(204).end();
    return;
  }
  const product = products.get(key) ?? {
    ...LINEN_SHIRT,
    handle,
  };
  response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ product }));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
