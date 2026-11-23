import { isLive, type BillingDto, type SubscriptionStatus } from "@price-watch/contract";
import { useGate, useUnit } from "effector-react";

import { BillingGate, billingRemote, manageBillingClicked, portalFx } from "../billing/model";
import { PlanPicker } from "../billing/PlanPicker";
import { PLAN_PRICE_LINE } from "../pricing/plan";
import { BUTTON_SECONDARY, Card, ErrorState, formatDay, LoadingState, PageHeader } from "../shared/ui";

const STATUS_TEXT: Record<SubscriptionStatus, string> = {
  no_subscription: "No plan yet",
  trialing: "Trial",
  active: "Active",
  past_due: "Payment failed",
  paused: "Paused",
  canceled: "Canceled",
};

export const BillingPage = () => {
  useGate(BillingGate);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing"
        subtitle="Your plan and the next payment. Card and invoices live in the Paddle portal."
      />
      <BillingView />
    </div>
  );
};

const BillingView = () => {
  const { billing, status, error } = useUnit({
    billing: billingRemote.$data,
    status: billingRemote.$status,
    error: billingRemote.$error,
  });

  if (status === "loading") {
    return <LoadingState />;
  }
  if (status === "error" || !billing) {
    return <ErrorState message={error} onRetry={() => billingRemote.fx()} />;
  }
  return (
    <div className="space-y-4">
      <CurrentPlan billing={billing} />
      {(billing.plan === null || !isLive(billing.subscription)) && <PlanPicker />}
    </div>
  );
};

const CurrentPlan = ({ billing }: { billing: BillingDto }) => {
  const isOpening = useUnit(portalFx.pending);

  return (
    <Card className="space-y-4 p-5">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Fact label="Plan" value={billing.plan ? PLAN_PRICE_LINE : "—"} />
        <Fact label="Status" value={STATUS_TEXT[billing.subscription]} />
        <Fact label="Next bill" value={billing.nextBilledAt ? formatDay(billing.nextBilledAt) : "—"} />
      </dl>
      <div className="flex flex-wrap gap-2">
        {billing.subscription !== "no_subscription" && (
          <button
            type="button"
            disabled={isOpening}
            onClick={() => manageBillingClicked()}
            className={BUTTON_SECONDARY}
          >
            Manage billing
          </button>
        )}
      </div>
      {billing.subscription !== "no_subscription" && (
        <p className="text-xs text-slate-500">Use Manage billing to update your card, download invoices or cancel.</p>
      )}
    </Card>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
};
