import type { Plan, SubscriptionStatus } from "./domain";

export const PLANS: Record<Plan, { name: string; monthlyCents: number; linkLimit: number }> = {
  starter: {
    name: "Starter",
    monthlyCents: 900,
    linkLimit: 250,
  },
  pro: {
    name: "Pro",
    monthlyCents: 1900,
    linkLimit: 1000,
  },
};

export const LIVE_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function isLive(status: SubscriptionStatus) {
  return LIVE_STATUSES.includes(status);
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// "$19" for whole dollars, "$19.50" otherwise.
export function formatPrice(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents);
}
