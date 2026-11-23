import { useUnit } from "effector-react";
import { Loader2 } from "lucide-react";

import { PlanCard } from "../pricing/PlanCard";
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
        One plan, everything included. Paddle is the merchant of record and adds sales tax or VAT where due.
      </p>
      {checkoutError && <Banner tone="danger">{checkoutError}</Banner>}
      {billing && !billing.checkout && <Banner tone="warning">Checkout isn't available on this server yet.</Banner>}
      <PlanCard
        className="sm:mx-0"
        action={
          <button
            type="button"
            disabled={!billing?.checkout}
            onClick={() => checkoutClicked()}
            className={`${BUTTON_PRIMARY} min-h-11 w-full`}
          >
            Start tracking
          </button>
        }
      />
    </section>
  );
};
