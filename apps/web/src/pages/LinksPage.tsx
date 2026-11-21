import { isLive } from "@price-watch/contract";
import { useGate, useUnit } from "effector-react";

import { BillingGate } from "../billing/model";
import { PlanPicker } from "../billing/PlanPicker";
import { $me } from "../session/model";
import { Card, INPUT, PageHeader } from "../shared/ui";

// The links table and the add button arrive with the links feature.
export const LinksPage = () => {
  const { me } = useUnit({ me: $me });
  const hasPlan = me !== null && me.plan !== null && isLive(me.subscription);

  return (
    <>
      <PageHeader title="Your links" />
      {!hasPlan && <PlanSection />}
      <Card className="p-5">
        <label className="text-sm font-medium">
          Product links
          <textarea
            disabled={!hasPlan}
            rows={4}
            placeholder="One product link per line"
            className={`${INPUT} disabled:bg-slate-50`}
          />
        </label>
      </Card>
    </>
  );
};

const PlanSection = () => {
  useGate(BillingGate);
  return <PlanPicker />;
};
