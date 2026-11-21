import type { FailReason, LinkStatus } from "@price-watch/contract";

import { LINK_STATUS_CONFIG } from "./config";

const CENTS_PER_UNIT = 100;
const PERCENT_DIGITS = 1;

export function formatCents({ cents }: { cents: number }) {
  return (cents / CENTS_PER_UNIT).toFixed(2);
}

// "24.99 → 19.99 (-5.00, -20.0%)"; a price that came from zero has no percentage.
export function formatChange({ fromCents, toCents }: { fromCents: number; toCents: number }) {
  const difference = toCents - fromCents;
  const sign = difference < 0 ? "-" : "+";
  const amount = `${sign}${formatCents({ cents: Math.abs(difference) })}`;
  const percent =
    fromCents === 0 ? "" : `, ${sign}${((Math.abs(difference) / fromCents) * 100).toFixed(PERCENT_DIGITS)}%`;

  return `${formatCents({ cents: fromCents })} → ${formatCents({ cents: toCents })} (${amount}${percent})`;
}

export function getLinkStatusLabel({ status, failReason }: { status: LinkStatus; failReason: FailReason | null }) {
  return LINK_STATUS_CONFIG[status === "failed" && failReason ? failReason : status].label;
}
