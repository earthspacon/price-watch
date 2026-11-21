import type { FailReason, LinkStatus } from "@price-watch/contract";
import { describe, expect, it } from "vitest";

import { getLinkStatusLabel } from "./lib";

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
