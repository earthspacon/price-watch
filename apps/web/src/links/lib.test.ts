import type { FailReason, LinkStatus } from "@price-watch/contract";
import { describe, expect, it } from "vitest";

import { formatChange, getLinkStatusLabel } from "./lib";

const FAIL_REASONS: FailReason[] = ["not_shopify", "unavailable", "blocked"];

describe("link status labels", () => {
  it("R12: every link status has its own label", () => {
    const label = ({ status, failReason = null }: { status: LinkStatus; failReason?: FailReason | null }) => {
      return getLinkStatusLabel({ status, failReason });
    };
    const failedLabels = FAIL_REASONS.map((failReason) => {
      return label({ status: "failed", failReason });
    });
    const shownLabels = [label({ status: "pending" }), label({ status: "paused" }), ...failedLabels];

    expect(label({ status: "pending" })).toBe("Checking…");
    expect(label({ status: "ok" })).toBeNull();
    expect(label({ status: "paused" })).toBe("Paused — over your plan");
    for (const failedLabel of failedLabels) {
      expect(failedLabel).toMatch(/\S/);
    }
    expect(new Set(shownLabels).size).toBe(shownLabels.length);
  });
});

describe("price change text", () => {
  it("R12: a change reads old → new with the amount and the percent", () => {
    expect(formatChange({ fromCents: 2499, toCents: 1999 })).toBe("24.99 → 19.99 (-5.00, -20.0%)");
    expect(formatChange({ fromCents: 1000, toCents: 1250 })).toBe("10.00 → 12.50 (+2.50, +25.0%)");
    expect(formatChange({ fromCents: 0, toCents: 500 })).toBe("0.00 → 5.00 (+5.00)");
  });
});
