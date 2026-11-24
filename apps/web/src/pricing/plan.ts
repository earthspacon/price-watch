import { formatPrice, PAID_PLAN, type BillingPeriod } from "@price-watch/contract";

export const PLAN_PRICE = formatPrice(PAID_PLAN.monthlyCents);
export const PLAN_YEARLY_PRICE = formatPrice(PAID_PLAN.yearlyCents);
export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "yearly"];
export const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};
export const PLAN_PRICES: Record<BillingPeriod, { price: string; line: string }> = {
  monthly: {
    price: PLAN_PRICE,
    line: `${PLAN_PRICE} / month · cancel anytime`,
  },
  yearly: {
    price: PLAN_YEARLY_PRICE,
    line: `${PLAN_YEARLY_PRICE} / year · 2 months free`,
  },
};
// The subscription doesn't record which price it was bought on, so the app names the plan without a period.
export const PAID_PLAN_LINE = "Paid · cancel anytime";
export const PLAN_PERKS = [
  `Up to ${PAID_PLAN.linkLimit.toLocaleString("en-US")} product links`,
  "Every link checked once a day",
  "One email at 7:00 with what changed",
  "The full price history as a CSV",
];
