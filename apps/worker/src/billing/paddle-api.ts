import type { Env } from "../env";

const API_BASE = {
  sandbox: "https://sandbox-api.paddle.com",
  production: "https://api.paddle.com",
};

export function getPaddleEnvironment(env: Env) {
  return env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

// developer.paddle.com/api-reference/customer-portals/create-customer-portal-session
export async function createPortalSession({
  env,
  apiKey,
  customerId,
  subscriptionId,
}: {
  env: Env;
  apiKey: string;
  customerId: string;
  subscriptionId: string | null;
}) {
  const response = await fetch(`${API_BASE[getPaddleEnvironment(env)]}/customers/${customerId}/portal-sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ subscription_ids: subscriptionId ? [subscriptionId] : [] }),
  });

  if (!response.ok) {
    throw new Error(`Paddle returned ${response.status}`);
  }
  const body: { data?: { urls?: { general?: { overview?: string } } } } = await response.json();
  const url = body.data?.urls?.general?.overview;

  if (!url) {
    throw new Error("Paddle returned no portal URL");
  }
  return url;
}

// developer.paddle.com/api-reference/subscriptions/update-subscription
export async function switchSubscriptionPrice({
  env,
  apiKey,
  subscriptionId,
  priceId,
}: {
  env: Env;
  apiKey: string;
  subscriptionId: string;
  priceId: string;
}) {
  const response = await fetch(`${API_BASE[getPaddleEnvironment(env)]}/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      proration_billing_mode: "prorated_immediately",
    }),
  });

  if (!response.ok) {
    throw new Error(`Paddle returned ${response.status}`);
  }
}
