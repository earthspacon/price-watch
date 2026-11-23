import { describe, expect, it } from "vitest";

import type { SubscriptionStatus } from "./domain";
import { formatPrice, isLive, PLANS } from "./plans";

describe("plans", () => {
  it("R4: one paid plan, $4 a month for 500 links", () => {
    expect(PLANS).toEqual({
      paid: {
        monthlyCents: 400,
        linkLimit: 500,
      },
    });
  });

  it("R4: prices read as whole dollars unless there are cents", () => {
    expect(formatPrice(PLANS.paid.monthlyCents)).toBe("$4");
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
