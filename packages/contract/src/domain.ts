export type Plan = "paid";

export type SubscriptionStatus = "no_subscription" | "trialing" | "active" | "past_due" | "paused" | "canceled";

export type LinkStatus = "pending" | "ok" | "failed" | "paused";

export type FailReason = "not_shopify" | "unavailable" | "blocked";

export type SkipReason = "invalid_url" | "not_product_link" | "duplicate" | "over_limit";

export type ApiError = {
  error: string;
  message: string;
};

export type MeDto = {
  email: string;
  plan: Plan | null;
  subscription: SubscriptionStatus;
  linkLimit: number;
  linkCount: number;
  timeZone: string | null;
};

export type LinkDto = {
  id: string;
  url: string;
  storeHost: string;
  title: string | null;
  variantTitle: string | null;
  priceCents: number | null;
  previousPriceCents: number | null;
  changedAt: string | null;
  status: LinkStatus;
  failReason: FailReason | null;
  lastCheckedAt: string | null;
  createdAt: string;
};

export type AddLinksResult = {
  added: number;
  skipped: Array<{ line: number; text: string; reason: SkipReason }>;
};

export const PRICE_CHECKER_PATH = "/api/tools/shopify-price-checker";
export const PRICE_CHECKER_RUNS_PER_DAY = 10;

export type PriceCheckVariantDto = {
  id: string;
  title: string | null;
  priceCents: number;
  compareAtCents: number | null;
};

// "blocked": the store refused or didn't answer; "not_found": no Shopify product data at that link.
export type PriceCheckDto =
  | { status: "ok"; storeHost: string; title: string; variants: PriceCheckVariantDto[] }
  | { status: "blocked" | "not_found"; storeHost: string };

export type BillingDto = {
  plan: Plan | null;
  subscription: SubscriptionStatus;
  nextBilledAt: string | null;
  checkout: {
    accountId: string;
    clientToken: string;
    environment: "sandbox" | "production";
    priceId: string;
  } | null;
};

export const EXPORT_CSV_COLUMNS = [
  "store",
  "product",
  "variant",
  "url",
  "price",
  "previous_price",
  "change",
  "change_percent",
  "recorded_at",
] as const;

export const SIGN_IN_OPTIONS_PATH = "/api/sign-in-options";

export type SignInOptionsDto = {
  google: boolean;
};
