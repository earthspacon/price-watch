import { PRICE_CHECKER_PATH, PRICE_CHECKER_RUNS_PER_DAY, type PriceCheckDto } from "@price-watch/contract";

import type { Env } from "../env";
import { HttpError, json, readJson, readString, route, type Route } from "../http";
import {
  buildProductJsonUrl,
  isDefaultVariantTitle,
  isTransientStatus,
  parseProduct,
  STORE_USER_AGENT,
} from "../links/check";
import { parseProductLink } from "../links/parse";
import { consumeRateLimit } from "../repo/shield";
import { readClientIp, sha256Hex } from "../shield/client";
import { TURNSTILE_HEADER, verifyTurnstile } from "../shield/turnstile";
import type { PublicContext } from "./context";

const PRICE_CHECKER_LIMIT = {
  limit: PRICE_CHECKER_RUNS_PER_DAY,
  windowMs: 24 * 60 * 60_000,
};
const PRICE_CHECKER_FETCH = {
  timeoutMs: 5_000,
  maxBytes: 1024 * 1024,
};

const URL_MAX_LENGTH = 2048;
const HTTPS = "https:";
const UNKNOWN_IP = "unknown";

// Free, no sign-in: anyone can look up one Shopify product's current prices. Nothing about the request is stored.
export const toolRoutes: Route<PublicContext>[] = [
  route("POST", PRICE_CHECKER_PATH, async ({ deps, request }) => {
    const data = await readJson(request);
    const link = readCheckableLink(readString({ data, key: "url", maxLength: URL_MAX_LENGTH }));
    const ip = readClientIp(request);

    const isHuman = await verifyTurnstile({
      secret: deps.env.TURNSTILE_SECRET_KEY,
      token: request.headers.get(TURNSTILE_HEADER),
      ip,
    });
    if (!isHuman) {
      throw new HttpError(403, "captcha_failed", "We couldn't confirm you're human. Reload the page and try again");
    }

    const isAllowed = await consumeRateLimit({
      db: deps.db,
      key: `price-checker:ip:${await sha256Hex(ip ?? UNKNOWN_IP)}`,
      now: deps.now(),
      ...PRICE_CHECKER_LIMIT,
    });
    if (!isAllowed) {
      throw new HttpError(
        429,
        "rate_limited",
        `You've used today's ${PRICE_CHECKER_RUNS_PER_DAY} free checks. Try again tomorrow`,
      );
    }

    return json(await readStoreProduct({ env: deps.env, ...link }));
  }),
];

function readCheckableLink(text: string) {
  const link = parseProductLink(text);

  if (!text.trim().startsWith(`${HTTPS}//`) || !link.ok) {
    throw new HttpError(
      400,
      "invalid_url",
      "Paste the full https link of a product page, like https://store.com/products/linen-shirt",
    );
  }
  return { host: link.host, handle: link.handle };
}

// Same rule as the daily check: a refusal or no answer is "blocked", never a guessed price.
async function readStoreProduct({ env, host, handle }: { env: Env; host: string; handle: string }) {
  const blocked: PriceCheckDto = { status: "blocked", storeHost: host };
  const notFound: PriceCheckDto = { status: "not_found", storeHost: host };

  try {
    const response = await fetch(buildProductJsonUrl({ env, host, handle }), {
      headers: {
        accept: "application/json",
        "user-agent": STORE_USER_AGENT,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(PRICE_CHECKER_FETCH.timeoutMs),
    });

    if (isTransientStatus(response.status)) {
      await response.body?.cancel();
      return blocked;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return notFound;
    }
    const product = parseProduct((await readCappedText(response)) ?? "");

    if (!product || product.variants.length === 0) {
      return notFound;
    }
    const result: PriceCheckDto = {
      status: "ok",
      storeHost: host,
      title: product.title,
      variants: product.variants.map((variant) => {
        return {
          id: variant.id,
          title: isDefaultVariantTitle(variant.title) ? null : variant.title,
          priceCents: variant.priceCents,
          compareAtCents: variant.compareAtCents,
        };
      }),
    };
    return result;
  } catch {
    return blocked;
  }
}

// Returns null once the body passes the size cap, without reading the rest.
async function readCappedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);

  if (declaredLength > PRICE_CHECKER_FETCH.maxBytes || !response.body) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let byteCount = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    byteCount += chunk.value.byteLength;
    if (byteCount > PRICE_CHECKER_FETCH.maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}
