import type { Deps } from "./deps";
import { claimOwnerAlert } from "./repo/accounts";

export type OwnerAlertKind = "paddle_bad_signature" | "payment_failed";

const ALERT_SUBJECTS: Record<OwnerAlertKind, string> = {
  paddle_bad_signature: "PriceDawn: a Paddle webhook failed its signature check",
  payment_failed: "PriceDawn: a customer payment failed",
};

const ALERT_INTERVAL_MS = 60 * 60 * 1000;

// At most one mail per kind per hour. A failing mailer must never fail the request that raised the alert.
export async function alertOwner({ deps, kind, text }: { deps: Deps; kind: OwnerAlertKind; text: string }) {
  const to = deps.env.OWNER_ALERT_EMAIL;

  if (!to) {
    return;
  }
  const now = deps.now();
  const isClaimed = await claimOwnerAlert({
    db: deps.db,
    kind,
    now,
    since: new Date(now.getTime() - ALERT_INTERVAL_MS),
  });

  if (!isClaimed) {
    return;
  }
  try {
    await deps.mailer.send({
      to,
      subject: ALERT_SUBJECTS[kind],
      text,
    });
  } catch (error) {
    console.error("owner alert not sent", kind, error instanceof Error ? error.name : "unknown");
  }
}
