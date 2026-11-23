import type { MeDto } from "@price-watch/contract";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import notShopifyHtml from "../fixtures/shopify/not-shopify.html?raw";
import { addLinks, apiFetch, db, productUrl, runChecks, runDigests, uniqueEmail } from "./helpers";
import { type OutboxMail, readOutbox, signInAccount } from "./session";
import { LINEN_SHIRT, type ShopifyProduct, setStoreProduct, setStoreResponse, withPrices } from "./stores";

const ZONE = "America/New_York";
const RIVAL = "rival.example";
const SHIRT = "linen-shirt";
const BLUE_SHIRT_URL = productUrl({ host: RIVAL, handle: SHIRT, variantId: 1001 });
const WHITE_SHIRT_URL = productUrl({ host: RIVAL, handle: SHIRT, variantId: 1002 });
const BROKEN_URL = productUrl({ host: "plain.example", handle: SHIRT });
const WOOL_COAT: ShopifyProduct = {
  id: 202,
  title: "Wool Coat",
  handle: "wool-coat",
  variants: [{ id: 2001, title: "Grey / 40", price: "120.00", sku: "WC-G40" }],
};
const COAT_URL = productUrl({ host: "alpha.example", handle: "wool-coat", variantId: 2001 });
const SIGN_IN_PATH = "/api/auth/magic-link/verify";
// New York is UTC-5 in January: checks are due from 06:00 UTC, the digest from 12:00 UTC.
const FIRST_CHECK = "2030-01-14T15:00:00.000Z";
const SECOND_CHECK = "2030-01-15T06:30:00.000Z";
const THIRD_CHECK = "2030-01-16T06:30:00.000Z";
const MORNING = "2030-01-15T12:00:00.000Z";
const LATER_THAT_DAY = "2030-01-15T13:00:00.000Z";
const NEXT_MORNING = "2030-01-16T12:00:00.000Z";
const FOOTER = `Your links: ${env.APP_URL}/app`;

async function startDigestAccount({ prefix, urls }: { prefix: string; urls: string[] }) {
  const email = uniqueEmail({ prefix });
  const { cookie } = await signInAccount({ email, plan: "paid", status: "active" });
  const saved = await saveTimeZone({ cookie, timeZone: ZONE });
  expect(saved.status, "PUT /api/account/time-zone").toBe(204);
  await addLinks({ cookie, urls });
  return { email, cookie };
}

function saveTimeZone({ cookie, timeZone }: { cookie: string; timeZone: string }) {
  return apiFetch({ cookie, path: "/api/account/time-zone", method: "PUT", body: { timeZone } });
}

async function readMe({ cookie }: { cookie: string }) {
  const response = await apiFetch({ cookie, path: "/api/me" });
  expect(response.status, "GET /api/me").toBe(200);
  return response.json<MeDto>();
}

function setShirtPrices({ blue, white }: { blue: string; white: string }) {
  setStoreProduct({
    host: RIVAL,
    handle: SHIRT,
    product: withPrices({ product: LINEN_SHIRT, prices: { 1001: blue, 1002: white } }),
  });
}

async function readDigests({ email }: { email: string }) {
  const mails = await readOutbox({ to: email });
  return mails.filter((mail) => !mail.body.includes(SIGN_IN_PATH));
}

async function readOnlyDigest({ email }: { email: string }) {
  const digests = await readDigests({ email });
  expect(digests).toHaveLength(1);
  return digests[0];
}

function readLines(mail: OutboxMail) {
  return mail.body.split(/\r?\n/).filter((line) => line.trim() !== "");
}

// A link that turns failed after the morning digest went out.
async function addBrokenLinkLater({ cookie }: { cookie: string }) {
  setStoreResponse({ host: "plain.example", handle: SHIRT, status: 200, body: notShopifyHtml });
  await addLinks({ cookie, urls: [BROKEN_URL] });
  await runChecks({ now: "2030-01-15T12:30:00.000Z" });
}

describe("morning digest", () => {
  it("R19: the morning email lists every change with difference and percent", async () => {
    const { email } = await startDigestAccount({ prefix: "digest", urls: [COAT_URL, BLUE_SHIRT_URL, WHITE_SHIRT_URL] });
    setStoreProduct({ host: "alpha.example", handle: "wool-coat", product: WOOL_COAT });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    setStoreProduct({
      host: "alpha.example",
      handle: "wool-coat",
      product: withPrices({ product: WOOL_COAT, prices: { 2001: "99.00" } }),
    });
    setShirtPrices({ blue: "19.99", white: "32.99" });
    await runChecks({ now: SECOND_CHECK });

    await runDigests({ now: MORNING });

    const mail = await readOnlyDigest({ email });
    expect(mail.subject).toBe("3 price changes at 2 stores");
    expect(readLines(mail)).toEqual([
      "alpha.example",
      "  Wool Coat — Grey / 40: 120.00 → 99.00 (-21.00, -17.5%)",
      `  ${COAT_URL}`,
      "rival.example",
      "  Linen Shirt — Blue / M: 24.99 → 19.99 (-5.00, -20.0%)",
      `  ${BLUE_SHIRT_URL}`,
      "  Linen Shirt — White / L: 29.99 → 32.99 (+3.00, +10.0%)",
      `  ${WHITE_SHIRT_URL}`,
      FOOTER,
    ]);
  });

  it("R19: two changes of one link show as one net change", async () => {
    const { email } = await startDigestAccount({ prefix: "net", urls: [BLUE_SHIRT_URL, WHITE_SHIRT_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    setShirtPrices({ blue: "22.99", white: "27.99" });
    await runChecks({ now: SECOND_CHECK });
    setShirtPrices({ blue: "19.99", white: "29.99" });
    await runChecks({ now: THIRD_CHECK });

    await runDigests({ now: NEXT_MORNING });

    const mail = await readOnlyDigest({ email });
    expect(mail.subject).toBe("1 price change at rival.example");
    expect(readLines(mail)).toEqual([
      "rival.example",
      "  Linen Shirt — Blue / M: 24.99 → 19.99 (-5.00, -20.0%)",
      `  ${BLUE_SHIRT_URL}`,
      FOOTER,
    ]);
  });

  it("R20: a quiet day sends no email", async () => {
    const { email, cookie } = await startDigestAccount({ prefix: "quiet", urls: [BLUE_SHIRT_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    await runChecks({ now: SECOND_CHECK });

    await runDigests({ now: MORNING });
    expect(await readDigests({ email })).toEqual([]);

    // The quiet day still counts: a failure after it waits for the next morning.
    await addBrokenLinkLater({ cookie });
    await runDigests({ now: LATER_THAT_DAY });
    expect(await readDigests({ email })).toEqual([]);
    await runDigests({ now: NEXT_MORNING });
    expect(await readDigests({ email })).toHaveLength(1);
  });

  it("R21: newly failed links are listed under couldn't check", async () => {
    const { email } = await startDigestAccount({ prefix: "failed", urls: [BLUE_SHIRT_URL, BROKEN_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    setStoreResponse({ host: "plain.example", handle: SHIRT, status: 200, body: notShopifyHtml });
    await runChecks({ now: FIRST_CHECK });
    setStoreResponse({ host: RIVAL, handle: SHIRT, status: 404, body: "Not Found" });
    await runChecks({ now: SECOND_CHECK });

    await runDigests({ now: MORNING });

    const mail = await readOnlyDigest({ email });
    expect(mail.subject).toBe("2 links couldn't be checked");
    const lines = readLines(mail);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Couldn't check:");
    expect(lines.at(-1)).toBe(FOOTER);
    const reasons = [BLUE_SHIRT_URL, BROKEN_URL].map((url) => {
      const line = lines.find((candidate) => candidate.includes(url));
      expect(line, `a line for ${url}`).toBeDefined();
      return (line ?? "").replace(url, "").trim();
    });
    expect(reasons.every((reason) => reason.length > 0)).toBe(true);
    expect(reasons[0], "unavailable and not_shopify read differently").not.toBe(reasons[1]);

    // Still failing the next day, but already reported.
    await runChecks({ now: THIRD_CHECK });
    await runDigests({ now: NEXT_MORNING });
    expect(await readDigests({ email })).toHaveLength(1);
  });

  it("R22: a second run the same day sends nothing", async () => {
    const { email, cookie } = await startDigestAccount({ prefix: "twice", urls: [BLUE_SHIRT_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    setShirtPrices({ blue: "19.99", white: "29.99" });
    await runChecks({ now: SECOND_CHECK });
    await runDigests({ now: MORNING });
    expect(await readDigests({ email })).toHaveLength(1);

    await addBrokenLinkLater({ cookie });
    await runDigests({ now: LATER_THAT_DAY });

    expect(await readDigests({ email })).toHaveLength(1);
  });

  it("R22: nothing is sent before 7:00 local time", async () => {
    const { email } = await startDigestAccount({ prefix: "early", urls: [BLUE_SHIRT_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    setShirtPrices({ blue: "19.99", white: "29.99" });
    await runChecks({ now: SECOND_CHECK });

    // 07:00 UTC is 02:00 in New York, and 11:59 UTC is 06:59.
    await runDigests({ now: "2030-01-15T07:00:00.000Z" });
    await runDigests({ now: "2030-01-15T11:59:00.000Z" });
    expect(await readDigests({ email })).toEqual([]);

    await runDigests({ now: MORNING });
    expect((await readOnlyDigest({ email })).subject).toBe("1 price change at rival.example");
  });

  it("R22: a failed send is retried the next hour", async () => {
    const { email } = await startDigestAccount({ prefix: "retry", urls: [BLUE_SHIRT_URL] });
    setShirtPrices({ blue: "24.99", white: "29.99" });
    await runChecks({ now: FIRST_CHECK });
    setShirtPrices({ blue: "19.99", white: "29.99" });
    await runChecks({ now: SECOND_CHECK });
    // The dev mailer writes to dev_outbox, so a failing insert stands in for a mail provider error.
    const trigger = `fail_mail_${crypto.randomUUID().replaceAll("-", "")}`;
    await db
      .prepare(
        `CREATE TRIGGER ${trigger} BEFORE INSERT ON dev_outbox WHEN lower(NEW.to_address) = '${email}' BEGIN SELECT RAISE(ABORT, 'mail provider is down'); END`,
      )
      .run();

    await runDigests({ now: MORNING });
    await db.prepare(`DROP TRIGGER ${trigger}`).run();
    expect(await readDigests({ email })).toEqual([]);
    await runDigests({ now: LATER_THAT_DAY });
    await runDigests({ now: "2030-01-15T14:00:00.000Z" });

    expect((await readOnlyDigest({ email })).subject).toBe("1 price change at rival.example");
  });
});

describe("time zone", () => {
  it("R23: the browser time zone is saved once", async () => {
    const { cookie } = await signInAccount({ email: uniqueEmail({ prefix: "zone" }), plan: "paid", status: "active" });
    expect((await readMe({ cookie })).timeZone).toBeNull();

    const saved = await saveTimeZone({ cookie, timeZone: ZONE });

    expect(saved.status).toBe(204);
    expect((await readMe({ cookie })).timeZone).toBe(ZONE);
  });

  it("R23: an unknown time zone gets 400", async () => {
    const { cookie } = await signInAccount({
      email: uniqueEmail({ prefix: "bad-zone" }),
      plan: "paid",
      status: "active",
    });
    expect((await saveTimeZone({ cookie, timeZone: ZONE })).status).toBe(204);

    const response = await saveTimeZone({ cookie, timeZone: "Mars/Olympus_Mons" });

    expect(response.status).toBe(400);
    expect((await readMe({ cookie })).timeZone).toBe(ZONE);
  });
});
