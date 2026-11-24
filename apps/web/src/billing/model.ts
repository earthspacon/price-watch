import { isLive, type BillingDto } from "@price-watch/contract";
import { attach, createEffect, createEvent, createStore, sample } from "effector";
import { createGate } from "effector-react";

import { $me, meRefreshRequested } from "../session/model";
import { apiRequest } from "../shared/api";
import { createRemote } from "../shared/remote";
import { toastShown } from "../shared/toast-model";
import { $period } from "../pricing/model";
import { loadPaddle, openPaddleCheckout } from "./paddle";

const ACTIVATION_POLL_MS = 2000;
const MAX_ACTIVATION_POLLS = 30;
const ACTIVATION_TIMEOUT_TEXT = "Your payment went through. Refresh the page in a minute to see your plan.";
const CHECKOUT_COMPLETED_EVENT = "checkout.completed";

export const BillingGate = createGate();

export const checkoutClicked = createEvent();
export const manageBillingClicked = createEvent();
const paddleEventReceived = createEvent<string>();

export const billingRemote = createRemote<void, BillingDto | null>({
  handler: () => {
    return apiRequest<BillingDto>({ path: "/api/billing" });
  },
  initial: null,
});

export const $isWaitingForPlan = createStore(false);
export const $checkoutError = createStore("");
const $pollAttempts = createStore(0);

const openCheckoutFx = attach({
  source: {
    billing: billingRemote.$data,
    me: $me,
    period: $period,
  },
  effect: async ({ billing, me, period }) => {
    const priceId = billing?.checkout?.priceIds[period];
    if (!billing?.checkout || !priceId || !me) {
      throw new Error("Checkout isn't available yet");
    }
    const paddle = await loadPaddle({
      checkout: billing.checkout,
      onEvent: (name) => paddleEventReceived(name),
    });
    openPaddleCheckout({
      paddle,
      priceId,
      email: me.email,
      accountId: billing.checkout.accountId,
    });
  },
});

export const portalFx = createEffect(async () => {
  const { url } = await apiRequest<{ url: string }>({ path: "/api/billing/portal", method: "POST" });
  window.location.assign(url);
});

const waitFx = createEffect(() => {
  return new Promise((resolve) => {
    setTimeout(resolve, ACTIVATION_POLL_MS);
  });
});

// #region load
sample({
  clock: BillingGate.open,
  target: billingRemote.fx,
});
// #endregion

// #region checkout
sample({
  clock: checkoutClicked,
  target: [openCheckoutFx, $checkoutError.reinit],
});

sample({
  clock: openCheckoutFx.failData,
  fn: (error) => error.message,
  target: $checkoutError,
});

// Closing the overlay without paying sends no completed event, so nothing changes and the picker stays.
sample({
  clock: paddleEventReceived,
  filter: (name) => name === CHECKOUT_COMPLETED_EVENT,
  fn: () => true,
  target: [$isWaitingForPlan, $pollAttempts.reinit, waitFx],
});
// #endregion

// #region wait for the webhook
// Paddle tells us about a new plan through the webhook a moment later; poll /api/billing until it arrives.
// A failed poll counts like an unapplied one, and the loop gives up after MAX_ACTIVATION_POLLS.
sample({
  clock: waitFx.done,
  source: $pollAttempts,
  fn: (attempts) => attempts + 1,
  target: $pollAttempts,
});

sample({
  clock: waitFx.done,
  source: $pollAttempts,
  filter: (attempts) => attempts < MAX_ACTIVATION_POLLS,
  target: billingRemote.fx,
});

sample({
  clock: waitFx.done,
  source: $pollAttempts,
  filter: (attempts) => attempts >= MAX_ACTIVATION_POLLS,
  fn: () => ACTIVATION_TIMEOUT_TEXT,
  target: $checkoutError,
});

sample({
  clock: waitFx.done,
  source: $pollAttempts,
  filter: (attempts) => attempts >= MAX_ACTIVATION_POLLS,
  fn: () => ({ text: ACTIVATION_TIMEOUT_TEXT, tone: "error" as const }),
  target: toastShown,
});

sample({
  clock: waitFx.done,
  source: $pollAttempts,
  filter: (attempts) => attempts >= MAX_ACTIVATION_POLLS,
  target: $isWaitingForPlan.reinit,
});

sample({
  clock: billingRemote.fx.doneData,
  source: $isWaitingForPlan,
  filter: (isWaiting, billing) => isWaiting && !isPlanApplied(billing),
  target: waitFx,
});

sample({
  clock: billingRemote.fx.fail,
  source: $isWaitingForPlan,
  filter: (isWaiting) => isWaiting,
  target: waitFx,
});

sample({
  clock: billingRemote.fx.doneData,
  source: $isWaitingForPlan,
  filter: (isWaiting, billing) => isWaiting && isPlanApplied(billing),
  target: [$isWaitingForPlan.reinit, meRefreshRequested],
});
// #endregion

// #region portal
sample({
  clock: manageBillingClicked,
  target: portalFx,
});

sample({
  clock: portalFx.failData,
  fn: (error) => {
    return {
      text: error.message,
      tone: "error" as const,
    };
  },
  target: toastShown,
});
// #endregion

function isPlanApplied(billing: BillingDto | null) {
  return billing !== null && billing.plan !== null && isLive(billing.subscription);
}
