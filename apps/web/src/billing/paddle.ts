import type { BillingDto } from "@price-watch/contract";

type PaddleEvent = { name?: string };

type PaddleJs = {
  Environment: { set: (environment: "sandbox") => void };
  Initialize: (options: { token: string; eventCallback: (event: PaddleEvent) => void }) => void;
  Checkout: {
    open: (options: {
      items: Array<{ priceId: string; quantity: number }>;
      customer: { email: string };
      customData: { account_id: string };
      settings: { displayMode: "overlay"; theme: "light"; locale: "en" };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

// Paddle.js v2 for Paddle Billing (not Paddle Classic).
const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";
const LOAD_ERROR = "Couldn't load Paddle checkout";

export async function loadPaddle({
  checkout,
  onEvent,
}: {
  checkout: NonNullable<BillingDto["checkout"]>;
  onEvent: (name: string) => void;
}) {
  if (!window.Paddle) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_JS_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(LOAD_ERROR));
      document.head.append(script);
    });
  }
  const paddle = window.Paddle;
  if (!paddle) {
    throw new Error(LOAD_ERROR);
  }
  if (checkout.environment === "sandbox") {
    paddle.Environment.set("sandbox");
  }
  paddle.Initialize({
    token: checkout.clientToken,
    eventCallback: (event) => {
      onEvent(event.name ?? "");
    },
  });
  return paddle;
}

export function openPaddleCheckout({
  paddle,
  priceId,
  email,
  accountId,
}: {
  paddle: PaddleJs;
  priceId: string;
  email: string;
  accountId: string;
}) {
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: { email },
    customData: { account_id: accountId },
    settings: {
      displayMode: "overlay",
      theme: "light",
      locale: "en",
    },
  });
}
