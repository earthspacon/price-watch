import { alertOwner } from "../alerts";
import type { Deps } from "../deps";
import { isRecord, json } from "../http";
import { findAccountIdForPaddle, getBillingRow, recordPaddleEvent, saveSubscription } from "../repo/accounts";
import { findPlanByPrice } from "./prices";
import { verifyPaddleSignature } from "./signature";
import { nextSubscriptionStatus, type PaddleStatus, type SubscriptionEvent } from "./state";

type PaddleEvent = {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
};

type SubscriptionData = {
  id: string;
  status: PaddleStatus;
  customerId: string | null;
  priceId: string | null;
  nextBilledAt: string | null;
  accountId: string | null;
};

type StatusEventType = Exclude<SubscriptionEvent["type"], "subscription.created" | "subscription.updated">;

const PAYMENT_FAILED_EVENT = "transaction.payment_failed";
const PADDLE_STATUSES: Record<PaddleStatus, true> = {
  active: true,
  canceled: true,
  past_due: true,
  paused: true,
  trialing: true,
};
const STATUS_EVENT_TYPES: Record<StatusEventType, true> = {
  "subscription.trialing": true,
  "subscription.activated": true,
  "subscription.past_due": true,
  "subscription.paused": true,
  "subscription.resumed": true,
  "subscription.canceled": true,
};

export async function handlePaddleWebhook({ deps, request }: { deps: Deps; request: Request }) {
  const rawBody = await request.text();
  const secret = deps.env.PADDLE_WEBHOOK_SECRET;
  const isValid = secret
    ? await verifyPaddleSignature({
        header: request.headers.get("paddle-signature"),
        rawBody,
        secret,
        now: deps.now(),
      })
    : false;

  if (!isValid) {
    console.warn("paddle webhook rejected: invalid signature");
    await alertOwner({
      deps,
      kind: "paddle_bad_signature",
      text: "A request to /paddle/webhook failed the signature check and was rejected. Check PADDLE_WEBHOOK_SECRET, or someone is probing the endpoint.",
    });
    return json({ error: "unauthorized", message: "Invalid signature" }, 401);
  }

  const event = parsePaddleEvent(rawBody);
  if (!event) {
    return json({ error: "invalid_json", message: "Not a Paddle event" }, 400);
  }

  const isNew = await recordPaddleEvent({
    db: deps.db,
    eventId: event.eventId,
    eventType: event.eventType,
    now: deps.now(),
  });
  if (!isNew) {
    return json({ received: true, outcome: "duplicate" });
  }

  // A failed apply must not leave the event id behind, or Paddle's retry would be answered as a duplicate.
  let outcome: string;
  try {
    outcome = await applyPaddleEvent({ deps, event });
  } catch (error) {
    await deps.db.prepare("DELETE FROM paddle_events WHERE event_id = ?").bind(event.eventId).run();
    throw error;
  }
  console.log("paddle webhook", event.eventType, outcome);
  return json({ received: true, outcome });
}

async function applyPaddleEvent({ deps, event }: { deps: Deps; event: PaddleEvent }) {
  if (event.eventType === PAYMENT_FAILED_EVENT) {
    await alertOwner({
      deps,
      kind: "payment_failed",
      text: `A subscription payment failed.\nAccount: ${readCustomAccountId(event.data) ?? "unknown"}\nSubscription: ${readOptionalString(event.data.subscription_id) ?? "unknown"}\nTransaction: ${readOptionalString(event.data.id) ?? "unknown"}`,
    });
    return "alerted";
  }
  if (!event.eventType.startsWith("subscription.")) {
    return "recorded";
  }
  const data = parseSubscriptionData(event.data);
  if (!data) {
    return "invalid_subscription";
  }

  const accountId = await findAccountIdForPaddle({
    db: deps.db,
    accountId: data.accountId,
    paddleSubscriptionId: data.id,
  });
  const row = accountId ? await getBillingRow({ db: deps.db, accountId }) : null;

  if (!accountId || !row) {
    return "unknown_account";
  }
  if (
    row.paddle_subscription_id &&
    row.paddle_subscription_id !== data.id &&
    event.eventType !== "subscription.created"
  ) {
    return "other_subscription";
  }

  const plan = findPlanByPrice({ env: deps.env, priceId: data.priceId });
  if (!plan) {
    return "unknown_price";
  }
  const transition = nextSubscriptionStatus({
    current: row.status,
    event: toSubscriptionEvent({ eventType: event.eventType, status: data.status }),
  });
  if (!transition.ok) {
    return transition.reason;
  }

  await saveSubscription({
    db: deps.db,
    accountId,
    now: deps.now(),
    update: {
      plan,
      status: transition.status,
      paddleSubscriptionId: data.id,
      paddleCustomerId: data.customerId ?? row.paddle_customer_id,
      nextBilledAt: transition.status === "canceled" ? null : data.nextBilledAt,
    },
  });
  return "applied";
}

function toSubscriptionEvent({ eventType, status }: { eventType: string; status: PaddleStatus }): SubscriptionEvent {
  if (eventType === "subscription.created") {
    return {
      type: "subscription.created",
      status,
    };
  }
  if (isStatusEventType(eventType)) {
    return { type: eventType };
  }
  return {
    type: "subscription.updated",
    status,
  };
}

function isPaddleStatus(value: unknown): value is PaddleStatus {
  return typeof value === "string" && Object.hasOwn(PADDLE_STATUSES, value);
}

function isStatusEventType(value: string): value is StatusEventType {
  return Object.hasOwn(STATUS_EVENT_TYPES, value);
}

function parsePaddleEvent(rawBody: string): PaddleEvent | null {
  const body: unknown = safeParse(rawBody);

  if (!isRecord(body) || !isRecord(body.data)) {
    return null;
  }
  const { event_id: eventId, event_type: eventType } = body;
  if (typeof eventId !== "string" || typeof eventType !== "string") {
    return null;
  }
  return {
    eventId,
    eventType,
    data: body.data,
  };
}

function parseSubscriptionData(data: Record<string, unknown>): SubscriptionData | null {
  const { id, status } = data;

  if (typeof id !== "string" || !isPaddleStatus(status)) {
    return null;
  }
  const items = Array.isArray(data.items) ? data.items : [];
  const price = isRecord(items[0]) && isRecord(items[0].price) ? items[0].price : null;

  return {
    id,
    status,
    customerId: readOptionalString(data.customer_id),
    priceId: readOptionalString(price?.id),
    nextBilledAt: readOptionalString(data.next_billed_at),
    accountId: readCustomAccountId(data),
  };
}

function readCustomAccountId(data: Record<string, unknown>) {
  return isRecord(data.custom_data) ? readOptionalString(data.custom_data.account_id) : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
