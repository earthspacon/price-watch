import { formatPrice, PLANS, type Plan } from "@price-watch/contract";
import type { ReactNode } from "react";

import { Card } from "../shared/ui";

const PLAN_ORDER: Plan[] = ["starter", "pro"];
const PLAN_PERKS = ["Every link checked daily", "A morning email with what changed", "CSV export of the price history"];

export const PlanCards = ({ renderAction }: { renderAction: (plan: Plan) => ReactNode }) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLAN_ORDER.map((plan) => {
        return <PlanCardView key={plan} plan={plan} action={renderAction(plan)} />;
      })}
    </div>
  );
};

const PlanCardView = ({ plan, action }: { plan: Plan; action: ReactNode }) => {
  const { name, monthlyCents, linkLimit } = PLANS[plan];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-2xl font-semibold tracking-tight">
          {formatPrice(monthlyCents)}
          <span className="ml-1 text-sm font-normal text-slate-500">/month</span>
        </p>
        <p className="text-sm text-slate-500">Up to {linkLimit.toLocaleString("en-US")} links</p>
      </div>
      <ul className="space-y-1 text-sm text-slate-600">
        {PLAN_PERKS.map((perk) => {
          return <li key={perk}>{perk}</li>;
        })}
      </ul>
      <div className="mt-auto">{action}</div>
    </Card>
  );
};
