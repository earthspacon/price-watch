declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    APP_URL: string;
    MAIL_FROM: string;
    DEV_ROUTES: string;
    BETTER_AUTH_SECRET: string;
    PADDLE_ENV: string;
    PADDLE_CLIENT_TOKEN: string;
    PADDLE_PRICE: string;
    PADDLE_API_KEY: string;
    PADDLE_WEBHOOK_SECRET: string;
    TURNSTILE_SECRET_KEY: string;
    OWNER_ALERT_EMAIL: string;
    DEV_STORE_ORIGIN: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    AUTH_LIMITER: RateLimit;
    LINKS_LIMITER: RateLimit;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

declare module "*?raw" {
  const content: string;
  export default content;
}
