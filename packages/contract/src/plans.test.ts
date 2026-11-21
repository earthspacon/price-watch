import { describe, expect, it } from "vitest";

import { PLANS } from "./plans";

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
});
