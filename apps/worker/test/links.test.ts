import type { AddLinksResult, MeDto } from "@price-watch/contract";
import { describe, expect, it } from "vitest";

import {
  addLinks,
  apiFetch,
  countRows,
  findLinkId,
  postLinks,
  productUrl,
  readLinks,
  recordCheckedPrices,
  uniqueEmail,
} from "./helpers";
import { signInAccount } from "./session";

const PAID_LINK_LIMIT = 500;
const PASTES_PER_MINUTE = 30;
const MAX_LINES_PER_PASTE = 1000;
const MAX_PASTE_BYTES = 200 * 1024;

function bulkUrls({ host, count }: { host: string; count: number }) {
  return Array.from({ length: count }, (_, index) => {
    return productUrl({ host, handle: `item-${index}` });
  });
}

function countAccountLinks({ accountId }: { accountId: string }) {
  return countRows({ sql: "SELECT COUNT(*) AS n FROM links WHERE account_id = ?", binds: [accountId] });
}

describe("links", () => {
  it("R9: valid product links are saved as pending", async () => {
    const { cookie } = await signInAccount({ email: uniqueEmail({ prefix: "paste" }), plan: "paid", status: "active" });

    const result = await addLinks({
      cookie,
      urls: [
        "https://rival.example/products/linen-shirt",
        "https://Other.example/fr/products/wool-coat?variant=1002",
        "http://third.example/collections/sale/products/canvas-cap",
      ],
    });

    expect(result).toEqual({ added: 3, skipped: [] });
    const links = await readLinks({ cookie });
    expect(links.map((link) => link.storeHost).sort()).toEqual(["other.example", "rival.example", "third.example"]);
    for (const link of links) {
      expect(link).toMatchObject({ status: "pending", priceCents: null, failReason: null, lastCheckedAt: null });
      expect(link.url).toMatch(/^https:\/\/[a-z.]+\/products\//);
    }
  });

  it("R9: invalid and duplicate lines are skipped with a reason", async () => {
    const { cookie } = await signInAccount({ email: uniqueEmail({ prefix: "skips" }), plan: "paid", status: "active" });
    const lines = [
      "https://rival.example/products/linen-shirt",
      "not a link",
      "https://rival.example/collections/all",
      "https://rival.example/en-gb/collections/sale/products/linen-shirt?utm_source=news",
      "http://127.0.0.1/products/linen-shirt",
      "https://localhost/products/linen-shirt",
      "https://rival.example:8443/products/linen-shirt",
      "https://user:secret@rival.example/products/linen-shirt",
      "ftp://rival.example/products/linen-shirt",
    ];

    const first = await addLinks({ cookie, urls: lines });
    const again = await addLinks({ cookie, urls: [lines[0]] });

    expect(first).toEqual({
      added: 1,
      skipped: [
        { line: 2, text: lines[1], reason: "invalid_url" },
        { line: 3, text: lines[2], reason: "not_product_link" },
        { line: 4, text: lines[3], reason: "duplicate" },
        { line: 5, text: lines[4], reason: "invalid_url" },
        { line: 6, text: lines[5], reason: "invalid_url" },
        { line: 7, text: lines[6], reason: "invalid_url" },
        { line: 8, text: lines[7], reason: "invalid_url" },
        { line: 9, text: lines[8], reason: "invalid_url" },
      ],
    });
    expect(again).toEqual({ added: 0, skipped: [{ line: 1, text: lines[0], reason: "duplicate" }] });
  });

  it("R9: the 31st paste in a minute gets 429", async () => {
    const { cookie } = await signInAccount({ email: uniqueEmail({ prefix: "burst" }), plan: "paid", status: "active" });
    const urls = bulkUrls({ host: "burst.example", count: PASTES_PER_MINUTE + 1 });

    const statuses = [];
    for (const url of urls) {
      statuses.push((await postLinks({ cookie, text: url })).status);
    }

    expect(statuses.slice(0, PASTES_PER_MINUTE).every((status) => status === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("R9: more than 1,000 lines get 413", async () => {
    const { accountId, cookie } = await signInAccount({
      email: uniqueEmail({ prefix: "huge" }),
      plan: "paid",
      status: "active",
    });

    const tooManyLines = await postLinks({
      cookie,
      text: bulkUrls({ host: "huge.example", count: MAX_LINES_PER_PASTE + 1 }).join("\n"),
    });
    const tooManyBytes = await postLinks({
      cookie,
      text: `https://huge.example/products/${"x".repeat(MAX_PASTE_BYTES)}`,
    });

    expect(tooManyLines.status).toBe(413);
    expect(await tooManyLines.json()).toMatchObject({ message: "Paste at most 1,000 links at once" });
    expect(tooManyBytes.status).toBe(413);
    expect(await countAccountLinks({ accountId })).toBe(0);
  });

  it("R10: links past the plan limit are skipped as over_limit", async () => {
    const single = await signInAccount({
      email: uniqueEmail({ prefix: "limit" }),
      plan: "paid",
      status: "active",
    });
    const urls = bulkUrls({ host: "limit.example", count: PAID_LINK_LIMIT + 2 });

    const result = await addLinks({ cookie: single.cookie, urls });

    expect(result.added).toBe(PAID_LINK_LIMIT);
    expect(result.skipped).toEqual([
      { line: PAID_LINK_LIMIT + 1, text: urls[PAID_LINK_LIMIT], reason: "over_limit" },
      { line: PAID_LINK_LIMIT + 2, text: urls[PAID_LINK_LIMIT + 1], reason: "over_limit" },
    ]);
    expect(await countAccountLinks({ accountId: single.accountId })).toBe(PAID_LINK_LIMIT);

    const twoTabs = await signInAccount({
      email: uniqueEmail({ prefix: "two-tabs" }),
      plan: "paid",
      status: "active",
    });
    const tabPaste = PAID_LINK_LIMIT * 0.6;
    const results: AddLinksResult[] = await Promise.all([
      addLinks({ cookie: twoTabs.cookie, urls: bulkUrls({ host: "tab-one.example", count: tabPaste }) }),
      addLinks({ cookie: twoTabs.cookie, urls: bulkUrls({ host: "tab-two.example", count: tabPaste }) }),
    ]);

    expect(results[0].added + results[1].added).toBe(PAID_LINK_LIMIT);
    expect([...results[0].skipped, ...results[1].skipped].every((skipped) => skipped.reason === "over_limit")).toBe(
      true,
    );
    expect(await countAccountLinks({ accountId: twoTabs.accountId })).toBe(PAID_LINK_LIMIT);
  });

  it("R11: removing a link deletes it and its price history", async () => {
    const { accountId, cookie } = await signInAccount({
      email: uniqueEmail({ prefix: "remove" }),
      plan: "paid",
      status: "active",
    });
    const urls = bulkUrls({ host: "full.example", count: PAID_LINK_LIMIT });
    expect((await addLinks({ cookie, urls })).added).toBe(PAID_LINK_LIMIT);
    const linkId = await findLinkId({ accountId, host: "full.example", handle: "item-0" });
    await recordCheckedPrices({
      linkId,
      accountId,
      title: "Linen Shirt",
      variantTitle: "Blue / M",
      history: [
        { priceCents: 2499, recordedAt: "2026-11-19T01:00:00.000Z" },
        { priceCents: 1999, recordedAt: "2026-11-20T01:00:00.000Z" },
      ],
    });

    const removed = await apiFetch({ cookie, path: `/api/links/${linkId}`, method: "DELETE" });

    expect(removed.status).toBe(204);
    expect(await countRows({ sql: "SELECT COUNT(*) AS n FROM links WHERE id = ?", binds: [linkId] })).toBe(0);
    expect(await countRows({ sql: "SELECT COUNT(*) AS n FROM price_points WHERE link_id = ?", binds: [linkId] })).toBe(
      0,
    );
    const me = await apiFetch({ cookie, path: "/api/me" });
    expect(await me.json<MeDto>()).toMatchObject({ linkCount: PAID_LINK_LIMIT - 1 });
    expect(await addLinks({ cookie, urls: [productUrl({ host: "full.example", handle: "one-more" })] })).toEqual({
      added: 1,
      skipped: [],
    });
  });

  it("R12: the list returns prices and the last change, latest change first", async () => {
    const { accountId, cookie } = await signInAccount({
      email: uniqueEmail({ prefix: "list" }),
      plan: "paid",
      status: "active",
    });
    await addLinks({
      cookie,
      urls: [
        productUrl({ host: "rival.example", handle: "linen-shirt", variantId: 1001 }),
        productUrl({ host: "other.example", handle: "wool-coat" }),
        productUrl({ host: "other.example", handle: "canvas-cap" }),
        productUrl({ host: "third.example", handle: "new-arrival" }),
      ],
    });
    const shirtId = await findLinkId({ accountId, host: "rival.example", handle: "linen-shirt" });
    const coatId = await findLinkId({ accountId, host: "other.example", handle: "wool-coat" });
    const capId = await findLinkId({ accountId, host: "other.example", handle: "canvas-cap" });
    await recordCheckedPrices({
      linkId: shirtId,
      accountId,
      title: "Linen Shirt",
      variantTitle: "Blue / M",
      history: [
        { priceCents: 2499, recordedAt: "2026-11-18T01:00:00.000Z" },
        { priceCents: 1999, recordedAt: "2026-11-19T01:00:00.000Z" },
      ],
    });
    await recordCheckedPrices({
      linkId: coatId,
      accountId,
      title: "Wool Coat",
      variantTitle: null,
      history: [
        { priceCents: 10000, recordedAt: "2026-11-18T01:00:00.000Z" },
        { priceCents: 12000, recordedAt: "2026-11-20T01:00:00.000Z" },
      ],
    });
    await recordCheckedPrices({
      linkId: capId,
      accountId,
      title: "Canvas Cap",
      variantTitle: null,
      history: [{ priceCents: 1500, recordedAt: "2026-11-20T01:00:00.000Z" }],
    });

    const links = await readLinks({ cookie });

    expect(links).toHaveLength(4);
    expect(links.slice(0, 2).map((link) => link.id)).toEqual([coatId, shirtId]);
    expect(links[0]).toMatchObject({
      storeHost: "other.example",
      title: "Wool Coat",
      variantTitle: null,
      priceCents: 12000,
      previousPriceCents: 10000,
      changedAt: "2026-11-20T01:00:00.000Z",
      status: "ok",
      failReason: null,
      lastCheckedAt: "2026-11-20T01:00:00.000Z",
    });
    expect(links[1]).toMatchObject({
      storeHost: "rival.example",
      title: "Linen Shirt",
      variantTitle: "Blue / M",
      priceCents: 1999,
      previousPriceCents: 2499,
      changedAt: "2026-11-19T01:00:00.000Z",
      status: "ok",
    });
    expect(links.find((link) => link.id === capId)).toMatchObject({
      priceCents: 1500,
      previousPriceCents: null,
      changedAt: null,
      status: "ok",
    });
    expect(links.find((link) => link.storeHost === "third.example")).toMatchObject({
      status: "pending",
      title: null,
      priceCents: null,
    });
  });
});
