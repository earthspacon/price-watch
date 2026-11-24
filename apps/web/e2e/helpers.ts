import { randomUUID } from "node:crypto";

import type { AddLinksResult, Plan, SubscriptionStatus } from "@price-watch/contract";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";

import { findChromePath, E2E_URL } from "./config";

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };
export const LINKS_PATH = "/app";

const LINK_PATTERN = /https?:\/\/\S+\/api\/auth\/magic-link\/verify\S+/;
const UI_TIMEOUT_MS = 10_000;
const DEFAULT_TIME_ZONE = "UTC";
// Each test stands in for a different visitor. Cloudflare overwrites this header at the edge in
// production, so only the signed-in-user rate limits apply here, not one shared localhost address.
const FIRST_CLIENT_IP = 10;
let nextClientIp = FIRST_CLIENT_IP;

function clientIp() {
  const octet = nextClientIp++;
  return `198.51.100.${octet}`;
}

export type Session = {
  context: BrowserContext;
  page: Page;
  consoleErrors: string[];
};

export function uniqueEmail({ prefix }: { prefix: string }) {
  return `${prefix}-${randomUUID().slice(0, 8)}@shop.example`;
}

// Every test tracks its own store, so a price set on the fake store never leaks into another test.
export function uniqueStoreHost() {
  return `rival-${randomUUID().slice(0, 8)}.example`;
}

export function productUrl({ host, handle, variantId }: { host: string; handle: string; variantId?: number }) {
  const query = variantId === undefined ? "" : `?variant=${variantId}`;
  return `https://${host}/products/${handle}${query}`;
}

export async function launchBrowser() {
  return chromium.launch({ executablePath: findChromePath() });
}

export async function openSession({
  browser,
  viewport = DESKTOP,
  timezoneId = DEFAULT_TIME_ZONE,
}: {
  browser: Browser;
  viewport?: typeof DESKTOP;
  timezoneId?: string;
}) {
  const context = await browser.newContext({
    baseURL: E2E_URL,
    viewport,
    timezoneId,
  });
  context.setDefaultTimeout(UI_TIMEOUT_MS);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  const session: Session = {
    context,
    page,
    consoleErrors,
  };
  return session;
}

export async function createAccount({
  email,
  plan,
  status,
}: {
  email: string;
  plan?: Plan;
  status?: SubscriptionStatus;
}) {
  const response = await fetch(`${E2E_URL}/dev/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      plan,
      status,
    }),
  });
  return (await response.json()) as { accountId: string };
}

export async function readOutbox({ email }: { email: string }) {
  const response = await fetch(`${E2E_URL}/dev/outbox?to=${encodeURIComponent(email)}`);
  return (await response.json()) as Array<{ body: string; subject: string }>;
}

export async function readMagicLink({ email }: { email: string }) {
  const mails = await readOutbox({ email });
  const link = mails[0]?.body.match(LINK_PATTERN)?.[0];

  if (!link) {
    throw new Error("no magic link in the dev outbox");
  }
  return link;
}

export async function signInWithUi({ page, email }: { page: Page; email: string }) {
  // Each test stands in for a different visitor. Cloudflare overwrites this header at the edge in
  // production, so locally it keeps the per-IP sign-in limit from counting the whole suite as one caller.
  const ip = clientIp();
  await page.route("**/api/auth/sign-in/magic-link", (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    return route.continue({
      headers: {
        ...route.request().headers(),
        "cf-connecting-ip": ip,
      },
    });
  });
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: /sign-in link/i }).click();
  await page.getByText("Check your email").waitFor();
  await page.goto(await readMagicLink({ email }));
}

// A signed-in account on the given plan, on the links page.
export async function openAccount({
  browser,
  plan,
  viewport,
  timezoneId,
}: {
  browser: Browser;
  plan?: Plan;
  viewport?: typeof DESKTOP;
  timezoneId?: string;
}) {
  const email = uniqueEmail({ prefix: plan ?? "no-plan" });
  const { accountId } = await createAccount({
    email,
    plan,
    status: plan ? "active" : undefined,
  });
  const session = await openSession({
    browser,
    viewport,
    timezoneId,
  });
  await signInWithUi({ page: session.page, email });
  return {
    ...session,
    email,
    accountId,
  };
}

export async function apiJson<T>({
  page,
  path,
  method = "GET",
  body,
}: {
  page: Page;
  path: string;
  method?: string;
  body?: unknown;
}) {
  const response = await page.request.fetch(path, {
    method,
    data: body,
    headers: { origin: E2E_URL },
  });
  return {
    status: response.status(),
    body: (await response.json().catch(() => null)) as T,
  };
}

export async function addLinksByApi({ page, urls }: { page: Page; urls: string[] }) {
  return apiJson<AddLinksResult>({
    page,
    path: "/api/links",
    method: "POST",
    body: { text: urls.join("\n") },
  });
}

// The same run the every-minute cron starts, at an explicit clock.
export async function runChecks({ now }: { now: Date }) {
  await fetch(`${E2E_URL}/dev/run-checks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ now: now.toISOString() }),
  });
}

// Holds matching requests until `release` is called, so a test can look at the pending UI.
export async function holdRequests({ page, url, method }: { page: Page; url: string; method: string }) {
  const held: Route[] = [];
  let isReleased = false;

  await page.route(url, (route) => {
    if (isReleased || route.request().method() !== method) {
      return route.fallback();
    }
    held.push(route);
  });
  return {
    release: async () => {
      isReleased = true;
      await Promise.all(
        held.map((route) => {
          return route.fallback();
        }),
      );
    },
  };
}

export async function failRequests({ page, url, method }: { page: Page; url: string; method: string }) {
  await page.route(url, (route) => {
    if (route.request().method() !== method) {
      return route.fallback();
    }
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "internal",
        message: "Something went wrong",
      }),
    });
  });
}
