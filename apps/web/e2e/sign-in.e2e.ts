import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MeDto } from "@price-watch/contract";

import {
  apiJson,
  holdRequests,
  launchBrowser,
  LINKS_PATH,
  openSession,
  readOutbox,
  signInWithUi,
  uniqueEmail,
} from "./helpers";

const MAGIC_LINK_REQUEST = "**/api/auth/sign-in/magic-link";

describe("email sign-in", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("R1: email sign-in lands on the links page", async () => {
    const { page } = await openSession({ browser });
    const email = uniqueEmail({ prefix: "sign-in" });

    await signInWithUi({ page, email });
    await page.getByText("Start the plan to begin tracking").waitFor();
    const me = await apiJson<MeDto>({ page, path: "/api/me" });
    const mails = await readOutbox({ email });

    expect(new URL(page.url()).pathname).toBe(LINKS_PATH);
    expect(me.body).toMatchObject({ email, plan: null, subscription: "no_subscription" });
    expect(mails).toHaveLength(1);
  });

  it("R1: the send button is disabled while the link is sent", async () => {
    const { page } = await openSession({ browser });
    const email = uniqueEmail({ prefix: "sending" });
    const request = await holdRequests({ page, url: MAGIC_LINK_REQUEST, method: "POST" });

    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: /email/i }).fill(email);
    await page.getByRole("button", { name: /sign-in link/i }).click();
    const sending = page.getByRole("button", { name: "Sending…" });
    await sending.waitFor();
    const isDisabledWhileSending = await sending.isDisabled();
    await request.release();
    await page.getByText("Check your email").waitFor();

    expect(isDisabledWhileSending).toBe(true);
  });
});
