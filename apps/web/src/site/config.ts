export const SITE_NAME = "PriceDawn";
export const SITE_URL = "https://pricedawn.com";
export const SITE_BRAND = "Spaceson Labs";
export const SELLER_LEGAL_NAME = "REPLACE_WITH legal name";
export const CONTACT_EMAIL = "REPLACE_WITH contact email";
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
  "/terms": "Terms of service",
  "/privacy": "Privacy policy",
  "/refunds": "Refund policy",
};
