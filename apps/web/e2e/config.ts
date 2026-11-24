export const E2E_PORT = 8795;
export const E2E_URL = `http://localhost:${E2E_PORT}`;
export const FAKE_STORE_PORT = 8796;
export const FAKE_STORE_URL = `http://localhost:${FAKE_STORE_PORT}`;
export const PADDLE_TEST_SECRET = "pdl_ntfset_e2e_test_secret";
export const PADDLE_TEST_CLIENT_TOKEN = "test_e2e_client_token";
export const PADDLE_TEST_PRICE = "pri_paid_e2e";
export const PADDLE_TEST_YEARLY_PRICE = "pri_paid_yearly_e2e";
// Cloudflare's "always passes" Turnstile secret; the SPA build uses the matching test sitekey.
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
export const CHROME_PATH =
  process.env.CHROME_PATH ??
  "/opt/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell";
