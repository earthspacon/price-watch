import { describe, expect, it } from "vitest";

import type { SubscriptionStatus } from "./domain";
import { formatPrice, isLive, PLANS } from "./plans";

describe("plans", () => {
  it("R4: Starter is $19 for 100 links and Pro $49 for 1,000", () => {
    expect(PLANS).toEqual({
      starter: {
        name: "Starter",
        monthlyCents: 1900,
        linkLimit: 100,
      },
      pro: {
        name: "Pro",
        monthlyCents: 4900,
        linkLimit: 1000,
      },
    });
  });

  it("R4: prices read as whole dollars unless there are cents", () => {
    expect(formatPrice(PLANS.starter.monthlyCents)).toBe("$19");
    expect(formatPrice(PLANS.pro.monthlyCents)).toBe("$49");
    expect(formatPrice(950)).toBe("$9.50");
  });

  it("R6: trialing, active and past_due plans are live, the rest are not", () => {
    const expectedLive: Record<SubscriptionStatus, boolean> = {
      no_subscription: false,
      trialing: true,
      active: true,
      past_due: true,
      paused: false,
      canceled: false,
    };

    for (const [status, expected] of Object.entries(expectedLive)) {
      expect(isLive(status as SubscriptionStatus), status).toBe(expected);
    }
  });
});
