import type { SkipReason } from "@price-watch/contract";

const PRODUCT_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections\/[^/]+\/)?products\/([^/?#.]+)/i;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const VARIANT_PARAM = "variant";
const VARIANT_ID = /^\d+$/;
const NUMERIC_LABEL = /^\d+$/;
const LOCALHOST_SUFFIX = ".localhost";

export type ParsedLink =
  | { ok: true; url: string; host: string; handle: string; variantKey: string }
  | { ok: false; reason: Extract<SkipReason, "invalid_url" | "not_product_link"> };

export function parseProductLink(text: string): ParsedLink {
  const url = parseUrl(text.trim());

  if (!url || !isPublicHost(url)) {
    return { ok: false, reason: "invalid_url" };
  }
  const handle = PRODUCT_PATH.exec(url.pathname)?.[1];

  if (!handle) {
    return { ok: false, reason: "not_product_link" };
  }
  const host = url.hostname.toLowerCase();
  const variantId = url.searchParams.get(VARIANT_PARAM) ?? "";
  const variantKey = VARIANT_ID.test(variantId) ? variantId : "";
  const normalizedHandle = handle.toLowerCase();
  const query = variantKey ? `?${VARIANT_PARAM}=${variantKey}` : "";

  return {
    ok: true,
    url: `https://${host}/products/${normalizedHandle}${query}`,
    host,
    handle: normalizedHandle,
    variantKey,
  };
}

function parseUrl(text: string) {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

// Only a named public host: the checker never fetches IP literals, localhost, other ports or URLs with credentials.
function isPublicHost(url: URL) {
  const labels = url.hostname.split(".");
  const isIpLiteral = url.hostname.startsWith("[") || NUMERIC_LABEL.test(labels.at(-1) ?? "");

  return (
    ALLOWED_PROTOCOLS.has(url.protocol) &&
    labels.length > 1 &&
    !labels.includes("") &&
    !isIpLiteral &&
    !url.hostname.endsWith(LOCALHOST_SUFFIX) &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}
