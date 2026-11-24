import type { Plan, SubscriptionStatus } from "./domain";

// One paid plan, $4 a month or $40 a year (2 months free). Kept as a record keyed by plan so stored rows and
// webhooks have a name to point at.
export const PLANS: Record<Plan, { monthlyCents: number; yearlyCents: number; linkLimit: number }> = {
  paid: {
    monthlyCents: 400,
    yearlyCents: 4000,
    linkLimit: 500,
  },
};

export const PAID_PLAN = PLANS.paid;

export const LIVE_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function isLive(status: SubscriptionStatus) {
  return LIVE_STATUSES.includes(status);
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// "$4" for whole dollars, "$4.50" otherwise.
export function formatPrice(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents);
}
