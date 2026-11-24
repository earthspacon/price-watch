import type { BillingPeriod } from "@price-watch/contract";
import { useUnit } from "effector-react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { $period, periodSelected } from "./model";
import { BILLING_PERIODS, PERIOD_LABELS, PLAN_PERKS, PLAN_PRICES } from "./plan";

// The one paid plan. The landing and the app pass their own call to action.
export const PlanCard = ({ action, className = "" }: { action: ReactNode; className?: string }) => {
  const { period } = useUnit({
    period: $period,
  });

  return (
    <section
      className={`mx-auto flex w-full max-w-sm flex-col gap-5 rounded-xl border border-slate-200 bg-surface p-6 shadow-sm ${className}`}
    >
      <PeriodSwitch period={period} />
      {/* Both prices are in the prerendered page so switching never moves the card. */}
      {BILLING_PERIODS.map((option) => {
        return (
          <div key={option} hidden={option !== period} className="space-y-1">
            <p className="text-4xl font-semibold tracking-tight">{PLAN_PRICES[option].price}</p>
            <p className="text-sm text-slate-500">{PLAN_PRICES[option].line}</p>
          </div>
        );
      })}
      <ul className="space-y-2 text-sm text-slate-700">
        {PLAN_PERKS.map((perk) => {
          return (
            <li key={perk} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              {perk}
            </li>
          );
        })}
      </ul>
      {action}
    </section>
  );
};

const PeriodSwitch = ({ period }: { period: BillingPeriod }) => {
  return (
    <div
      className="inline-flex self-start rounded-lg bg-slate-100 p-0.5 text-sm"
      role="group"
      aria-label="Billing period"
    >
      {BILLING_PERIODS.map((option) => {
        const isActive = option === period;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => periodSelected(option)}
            className={`min-h-11 rounded-md px-4 font-medium ${isActive ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {PERIOD_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
};
