type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "flexible";
      theme: "dark" | "light";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare's "always passes" test sitekey; production builds set VITE_TURNSTILE_SITE_KEY (DEPLOY.md).
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_JS_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY;

export async function loadTurnstile() {
  if (window.turnstile) {
    return window.turnstile;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load the bot check"));
    document.head.append(script);
  });
  if (!window.turnstile) {
    throw new Error("Couldn't load the bot check");
  }
  return window.turnstile;
}
