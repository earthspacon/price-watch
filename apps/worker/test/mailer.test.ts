import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBrevoMailer, createMailer } from "../src/mailer";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const API_KEY = "xkeysib-test-key";

type BrevoCall = {
  url: string;
  apiKey: string | null;
  body: {
    sender: { name?: string; email: string };
    to: { email: string }[];
    subject: string;
    textContent: string;
    htmlContent: string;
  };
};

function stubBrevo({ status = 201 }: { status?: number } = {}) {
  const calls: BrevoCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    calls.push({
      url: request.url,
      apiKey: request.headers.get("api-key"),
      body: await request.json(),
    });
    return Response.json({ messageId: "<example@smtp-relay.mailin.fr>" }, { status });
  });
  return calls;
}

describe("Mailer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends through Brevo with the sender split out of MAIL_FROM", async () => {
    const calls = stubBrevo();
    const mailer = createBrevoMailer({
      apiKey: API_KEY,
      from: "PriceDawn <login@pricedawn.example>",
    });

    await mailer.send({
      to: "owner@example.com",
      subject: "Your PriceDawn sign-in link",
      text: "Sign in to PriceDawn:\nhttps://pricedawn.example/verify?token=a&b=1",
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe(BREVO_URL);
    expect(call.apiKey).toBe(API_KEY);
    expect(call.body.sender).toEqual({ name: "PriceDawn", email: "login@pricedawn.example" });
    expect(call.body.to).toEqual([{ email: "owner@example.com" }]);
    expect(call.body.subject).toBe("Your PriceDawn sign-in link");
    expect(call.body.textContent).toBe("Sign in to PriceDawn:\nhttps://pricedawn.example/verify?token=a&b=1");
  });

  it("gives Brevo an escaped HTML copy of the text with clickable links", async () => {
    const calls = stubBrevo();
    const mailer = createBrevoMailer({ apiKey: API_KEY, from: "login@pricedawn.example" });

    await mailer.send({
      to: "owner@example.com",
      subject: "Invite",
      text: "Join <Acme & Co>:\nhttps://pricedawn.example/verify?token=a&b=1",
    });

    const [call] = calls;
    expect(call.body.sender).toEqual({ email: "login@pricedawn.example" });
    expect(call.body.htmlContent).toContain("Join &lt;Acme &amp; Co&gt;:<br>");
    expect(call.body.htmlContent).toContain(
      '<a href="https://pricedawn.example/verify?token=a&amp;b=1">https://pricedawn.example/verify?token=a&amp;b=1</a>',
    );
    expect(call.body.htmlContent).not.toContain("<Acme");
  });

  it("fails the send when Brevo rejects the mail", async () => {
    stubBrevo({ status: 401 });
    const mailer = createBrevoMailer({ apiKey: API_KEY, from: "PriceDawn <login@pricedawn.example>" });

    await expect(
      mailer.send({
        to: "owner@example.com",
        subject: "Your PriceDawn sign-in link",
        text: "Sign in",
      }),
    ).rejects.toThrow("Brevo returned 401");
  });

  it("refuses to run in production without a Brevo key", () => {
    expect(() => {
      return createMailer({ ...env, DEV_ROUTES: "0", BREVO_API_KEY: undefined });
    }).toThrow("BREVO_API_KEY is not set");
  });
});
