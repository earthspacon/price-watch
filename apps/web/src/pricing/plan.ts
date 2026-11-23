import { formatPrice, PAID_PLAN } from "@price-watch/contract";

export const PLAN_PRICE = formatPrice(PAID_PLAN.monthlyCents);
export const PLAN_PRICE_LINE = `${PLAN_PRICE} / month · cancel anytime`;
export const PLAN_PERKS = [
  `Up to ${PAID_PLAN.linkLimit.toLocaleString("en-US")} product links`,
  "Every link checked once a day",
  "One email at 7:00 with what changed",
  "The full price history as a CSV",
];
