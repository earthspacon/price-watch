import type { FailReason, LinkStatus, SkipReason } from "@price-watch/contract";

// A null label means the link needs no badge.
export const LINK_STATUS_CONFIG: Record<LinkStatus | FailReason, { label: string | null }> = {
  pending: { label: "Checking…" },
  ok: { label: null },
  paused: { label: "Paused — over your plan" },
  failed: { label: "Check failed" },
  not_shopify: { label: "Not a Shopify store" },
  unavailable: { label: "Product not found" },
  blocked: { label: "Store blocks checks" },
};

export const SKIP_REASON_CONFIG: Record<SkipReason, { label: string }> = {
  invalid_url: { label: "Not a valid link" },
  not_product_link: { label: "Not a product link" },
  duplicate: { label: "Already tracked" },
  over_limit: { label: "Over your plan limit" },
};
