import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { PLAN_PERKS, PLAN_PRICE, PLAN_PRICE_LINE } from "./plan";

// The one paid plan. The landing and the app pass their own call to action.
export const PlanCard = ({ action, className = "" }: { action: ReactNode; className?: string }) => {
  return (
    <section
      className={`mx-auto flex w-full max-w-sm flex-col gap-5 rounded-xl border border-slate-200 bg-surface p-6 shadow-sm ${className}`}
    >
      <div className="space-y-1">
        <p className="text-4xl font-semibold tracking-tight">{PLAN_PRICE}</p>
        <p className="text-sm text-slate-500">{PLAN_PRICE_LINE}</p>
      </div>
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
