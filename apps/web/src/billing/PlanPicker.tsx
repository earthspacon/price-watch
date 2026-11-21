import { PLANS } from "@price-watch/contract";
import { useUnit } from "effector-react";
import { Loader2 } from "lucide-react";

import { PlanCards } from "../pricing/PlanCards";
import { Banner, BUTTON_PRIMARY } from "../shared/ui";
import { $checkoutError, $isWaitingForPlan, billingRemote, checkoutClicked } from "./model";

// Needs BillingGate open: the prices and the account id for checkout come from /api/billing.
export const PlanPicker = () => {
  const { billing, checkoutError, isWaiting } = useUnit({
    billing: billingRemote.$data,
    checkoutError: $checkoutError,
    isWaiting: $isWaitingForPlan,
  });

  if (isWaiting) {
    return (
      <Banner tone="info">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Payment received. Turning your plan on…
        </span>
      </Banner>
    );
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">
        Choose a plan below. Paddle is the merchant of record and adds sales tax or VAT where due.
      </p>
      {checkoutError && <Banner tone="danger">{checkoutError}</Banner>}
      {billing && !billing.checkout && <Banner tone="warning">Checkout isn't available on this server yet.</Banner>}
      <PlanCards
        renderAction={(plan) => {
          return (
            <button
              type="button"
              disabled={!billing?.checkout}
              onClick={() => checkoutClicked(plan)}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              Start {PLANS[plan].name}
            </button>
          );
        }}
      />
    </section>
  );
};
