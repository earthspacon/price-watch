import { useEffect, useRef } from "react";

import { loadTurnstile, TURNSTILE_SITE_KEY } from "../session/turnstile";

// Cloudflare's bot check; the token it returns goes with the request so the server can verify it.
// The site is dark unless `data-theme="light"` is set, and the widget takes the theme it is rendered in.
export const TurnstileWidget = ({
  onSolved,
  onExpired,
}: {
  onSolved: (token: string) => void;
  onExpired: () => void;
}) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId = "";
    let isMounted = true;

    loadTurnstile()
      .then((turnstile) => {
        if (!isMounted || !container.current) {
          return;
        }
        widgetId = turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: "flexible",
          theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
          callback: onSolved,
          "expired-callback": onExpired,
          "error-callback": onExpired,
        });
      })
      .catch(() => {
        onExpired();
      });

    return () => {
      isMounted = false;
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [onSolved, onExpired]);

  return <div ref={container} className="min-h-[65px]" />;
};
