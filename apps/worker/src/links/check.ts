import { isRecord } from "../http";
import { type Env, isDev } from "../env";

export type CheckResult =
  | { kind: "ok"; title: string; variantTitle: string | null; priceCents: number }
  | { kind: "transient" }
  | { kind: "gone" };

export type StoreFetcher = (product: { host: string; handle: string }) => Promise<Response>;

export type CheckedLink = { storeHost: string; handle: string; variantKey: string };

export const STORE_USER_AGENT = "PriceDawn/1.0 (+https://pricedawn.spacesonlabs.com)";

const CHECK_TIMEOUT_MS = 10_000;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
// Shopify shows this title for the only variant of a product without options.
const DEFAULT_VARIANT_TITLE = "Default Title";
const PRICE = /^(\d+)(?:\.(\d{1,2}))?$/;
const CENTS_PER_UNIT = 100;
const CENT_DIGITS = 2;

type Variant = { id: string; title: string; priceCents: number };

export function createStoreFetcher({ env }: { env: Env }): StoreFetcher {
  const devOrigin = isDev(env) ? env.DEV_STORE_ORIGIN : "";

  return ({ host, handle }) => {
    const origin = devOrigin ? `${devOrigin}/${host}` : `https://${host}`;

    return fetch(`${origin}/products/${handle}.json`, {
      headers: {
        accept: "application/json",
        "user-agent": STORE_USER_AGENT,
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  };
}

export async function checkLink({ link, fetchStore }: { link: CheckedLink; fetchStore: StoreFetcher }) {
  const body = await readStoreAnswer({ link, fetchStore });

  if (body.kind !== "answered") {
    return body;
  }
  const product = parseProduct(body.text);
  const variant = product?.variants.find((candidate) => {
    return link.variantKey === "" || candidate.id === link.variantKey;
  });

  if (!product || !variant) {
    return gone();
  }
  const result: CheckResult = {
    kind: "ok",
    title: product.title,
    variantTitle: variant.title === DEFAULT_VARIANT_TITLE ? null : variant.title,
    priceCents: variant.priceCents,
  };
  return result;
}

// Throttling, bot walls and outages pass with time; any other answer means the product JSON isn't there.
async function readStoreAnswer({ link, fetchStore }: { link: CheckedLink; fetchStore: StoreFetcher }) {
  try {
    const response = await fetchStore({ host: link.storeHost, handle: link.handle });

    if (isTransientStatus(response.status)) {
      await response.body?.cancel();
      return transient();
    }
    if (!response.ok) {
      await response.body?.cancel();
      return gone();
    }
    return { kind: "answered" as const, text: await response.text() };
  } catch {
    return transient();
  }
}

function isTransientStatus(status: number) {
  return status === HTTP_FORBIDDEN || status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR;
}

function transient(): CheckResult {
  return { kind: "transient" };
}

function gone(): CheckResult {
  return { kind: "gone" };
}

function parseProduct(text: string) {
  const data = parseJson(text);
  const product = isRecord(data) ? data.product : null;

  if (!isRecord(product) || typeof product.title !== "string" || !Array.isArray(product.variants)) {
    return null;
  }
  const variants = product.variants.map(parseVariant).filter((variant) => variant !== null);
  return { title: product.title, variants };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseVariant(value: unknown): Variant | null {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.price !== "string") {
    return null;
  }
  const priceCents = parsePriceCents(value.price);

  if (priceCents === null || (typeof value.id !== "number" && typeof value.id !== "string")) {
    return null;
  }
  return { id: String(value.id), title: value.title, priceCents };
}

// Prices are decimal strings ("24.99", "24.9", "1500"); integer cents avoid float rounding.
function parsePriceCents(price: string) {
  const match = PRICE.exec(price.trim());

  if (!match) {
    return null;
  }
  const fraction = (match[2] ?? "").padEnd(CENT_DIGITS, "0");
  return Number(match[1]) * CENTS_PER_UNIT + Number(fraction);
}
