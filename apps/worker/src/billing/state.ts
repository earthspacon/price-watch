import type { SubscriptionStatus } from "@price-watch/contract";

export type PaddleStatus = "active" | "canceled" | "past_due" | "paused" | "trialing";

export type SubscriptionEvent =
  | { type: "subscription.created"; status: PaddleStatus }
  | { type: "subscription.updated"; status: PaddleStatus }
  | { type: "subscription.trialing" }
  | { type: "subscription.activated" }
  | { type: "subscription.past_due" }
  | { type: "subscription.paused" }
  | { type: "subscription.resumed" }
  | { type: "subscription.canceled" };

type Transition = { ok: true; status: SubscriptionStatus } | { ok: false; reason: "illegal_transition" };

// Every status a subscription may move to from each status. Staying in place is always allowed.
const LEGAL_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  no_subscription: ["trialing", "active"],
  trialing: ["active", "past_due", "paused", "canceled"],
  active: ["past_due", "paused", "canceled"],
  past_due: ["active", "paused", "canceled"],
  paused: ["active", "canceled"],
  canceled: ["trialing", "active"],
};

const EVENT_TARGETS: Record<
  Exclude<SubscriptionEvent["type"], "subscription.created" | "subscription.updated">,
  SubscriptionStatus
> = {
  "subscription.trialing": "trialing",
  "subscription.activated": "active",
  "subscription.past_due": "past_due",
  "subscription.paused": "paused",
  "subscription.resumed": "active",
  "subscription.canceled": "canceled",
};

export function nextSubscriptionStatus({
  current,
  event,
}: {
  current: SubscriptionStatus;
  event: SubscriptionEvent;
}): Transition {
  const target = "status" in event ? event.status : EVENT_TARGETS[event.type];

  if (target === current || LEGAL_TRANSITIONS[current].includes(target)) {
    return {
      ok: true,
      status: target,
    };
  }
  return {
    ok: false,
    reason: "illegal_transition",
  };
}
