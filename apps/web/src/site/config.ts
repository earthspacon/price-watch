export const SITE_NAME = "PriceDawn";
export const SITE_URL = "https://pricedawn.spacesonlabs.com";
export const SITE_BRAND = "Spaceson Labs";
export const STUDIO_URL = "https://spacesonlabs.com";
export const SELLER_LEGAL_NAME = SITE_BRAND;
export const CONTACT_EMAIL = "pricedawn@spacesonlabs.com";
export const OG_IMAGE = {
  path: "/og.png",
  width: 1200,
  height: 630,
};
export const REFUND_DAYS = 14;

export const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/prisync-alternative",
  "/track-shopify-competitor-prices",
  "/tools/shopify-price-checker",
  "/terms",
  "/privacy",
  "/refunds",
] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

export const PAGE_LABELS: Record<PublicPath, string> = {
  "/": "Home",
  "/pricing": "Pricing",
  "/prisync-alternative": "PriceDawn compared with Prisync and PriceMole",
  "/track-shopify-competitor-prices": "How to track Shopify competitor prices",
  "/tools/shopify-price-checker": "Free Shopify price checker",
  "/terms": "Terms of service",
  "/privacy": "Privacy policy",
  "/refunds": "Refund policy",
};
