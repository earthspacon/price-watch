export type Env = {
  DB: D1Database;
  ASSETS?: Fetcher;
  APP_URL: string;
  MAIL_FROM: string;
  DEV_ROUTES: string;
  PADDLE_ENV: string;
  PADDLE_CLIENT_TOKEN?: string;
  PADDLE_PRICE?: string;
  PADDLE_PRICE_YEARLY?: string;
  OWNER_ALERT_EMAIL?: string;
  DEV_STORE_ORIGIN?: string;
  BETTER_AUTH_SECRET: string;
  BREVO_API_KEY?: string;
  PADDLE_API_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_LIMITER: RateLimit;
  LINKS_LIMITER: RateLimit;
};

export function isDev(env: Env) {
  return env.DEV_ROUTES === "1";
}
