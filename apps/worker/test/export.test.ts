import { EXPORT_CSV_COLUMNS } from "@price-watch/contract";
import { describe, expect, it } from "vitest";

import { addLinks, apiFetch, findLinkId, productUrl, recordCheckedPrices, uniqueEmail } from "./helpers";
import { signInAccount } from "./session";

const EXPORT_PATH = "/api/export.csv";
const RIVAL = "rival.example";
const SHIRT = "linen-shirt";
const BLUE_SHIRT_URL = productUrl({ host: RIVAL, handle: SHIRT, variantId: 1001 });
const COAT_URL = productUrl({ host: "alpha.example", handle: "wool-coat" });
const FIRST_DAY = "2030-01-14T06:10:00.000Z";
const SECOND_DAY = "2030-01-15T06:10:00.000Z";
const THIRD_DAY = "2030-01-16T06:10:00.000Z";
const FORMULA_TITLES = [
  { host: "one.example", title: '=HYPERLINK("https://evil.example","x")' },
  { host: "two.example", title: "+1+1" },
  { host: "three.example", title: "-2+3" },
  { host: "four.example", title: "@SUM(A1:A2)" },
];
const TAB_VARIANT = "\tGrey / 40";

// RFC 4180: quoted cells may hold commas, doubled quotes and line breaks.
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || (char === "\r" && text[index + 1] === "\n")) {
      if (char === "\r") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function downloadCsv({ cookie }: { cookie: string }) {
  const response = await apiFetch({ cookie, path: EXPORT_PATH });
  expect(response.status, `GET ${EXPORT_PATH}`).toBe(200);
  expect(response.headers.get("content-type") ?? "").toMatch(/^text\/csv/);
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="pricedawn-history.csv"');
  const rows = parseCsv(await response.text());
  expect(rows[0], "header row").toEqual([...EXPORT_CSV_COLUMNS]);
  return rows.slice(1).map((cells) => {
    expect(cells, "a full row").toHaveLength(EXPORT_CSV_COLUMNS.length);
    return Object.fromEntries(EXPORT_CSV_COLUMNS.map((column, index) => [column, cells[index]]));
  });
}

function byRecordedAt(left: Record<string, string>, right: Record<string, string>) {
  return `${left.recorded_at} ${left.url}`.localeCompare(`${right.recorded_at} ${right.url}`);
}

async function startExportAccount({ prefix }: { prefix: string }) {
  return signInAccount({ email: uniqueEmail({ prefix }), plan: "paid", status: "active" });
}

describe("price history export", () => {
  it("R24: the CSV has one row per price point", async () => {
    const { accountId, cookie } = await startExportAccount({ prefix: "export" });
    await addLinks({ cookie, urls: [BLUE_SHIRT_URL, COAT_URL] });
    await recordCheckedPrices({
      linkId: await findLinkId({ accountId, host: RIVAL, handle: SHIRT }),
      accountId,
      title: 'Linen Shirt, "Summer"',
      variantTitle: "Blue / M",
      history: [
        { priceCents: 2499, recordedAt: FIRST_DAY },
        { priceCents: 1999, recordedAt: SECOND_DAY },
      ],
    });
    await recordCheckedPrices({
      linkId: await findLinkId({ accountId, host: "alpha.example", handle: "wool-coat" }),
      accountId,
      title: "Wool Coat",
      variantTitle: null,
      history: [
        { priceCents: 12000, recordedAt: FIRST_DAY },
        { priceCents: 13200, recordedAt: THIRD_DAY },
      ],
    });

    const rows = (await downloadCsv({ cookie })).sort(byRecordedAt);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => [row.store, row.product, row.variant, row.url, row.recorded_at])).toEqual([
      ["alpha.example", "Wool Coat", "", COAT_URL, FIRST_DAY],
      [RIVAL, 'Linen Shirt, "Summer"', "Blue / M", BLUE_SHIRT_URL, FIRST_DAY],
      [RIVAL, 'Linen Shirt, "Summer"', "Blue / M", BLUE_SHIRT_URL, SECOND_DAY],
      ["alpha.example", "Wool Coat", "", COAT_URL, THIRD_DAY],
    ]);
    const [firstCoat, firstShirt, cheaperShirt, dearerCoat] = rows;
    expect([firstCoat.price, firstCoat.previous_price, firstCoat.change, firstCoat.change_percent]).toEqual([
      "120.00",
      "",
      "",
      "",
    ]);
    expect([firstShirt.price, firstShirt.previous_price, firstShirt.change]).toEqual(["24.99", "", ""]);
    expect([cheaperShirt.price, cheaperShirt.previous_price]).toEqual(["19.99", "24.99"]);
    // A leading minus is a formula prefix, so the cell may carry the neutralizing quote.
    expect(cheaperShirt.change).toMatch(/^'?-5\.00$/);
    expect(cheaperShirt.change_percent).toMatch(/^'?-20\.0%?$/);
    expect([dearerCoat.price, dearerCoat.previous_price]).toEqual(["132.00", "120.00"]);
    expect(dearerCoat.change).toMatch(/^'?\+?12\.00$/);
    expect(dearerCoat.change_percent).toMatch(/^'?\+?10\.0%?$/);
  });

  it("R24: an account without price points gets the header only", async () => {
    const { cookie } = await startExportAccount({ prefix: "export-empty" });
    await addLinks({ cookie, urls: [BLUE_SHIRT_URL] });

    const rows = await downloadCsv({ cookie });

    expect(rows).toEqual([]);
  });

  it("R24: cells starting with = + - @ are neutralized", async () => {
    const { accountId, cookie } = await startExportAccount({ prefix: "export-formula" });
    await addLinks({
      cookie,
      urls: FORMULA_TITLES.map(({ host }) => productUrl({ host, handle: "odd-product" })),
    });
    for (const [index, { host, title }] of FORMULA_TITLES.entries()) {
      await recordCheckedPrices({
        linkId: await findLinkId({ accountId, host, handle: "odd-product" }),
        accountId,
        title,
        variantTitle: index === 0 ? TAB_VARIANT : null,
        history: [{ priceCents: 1000, recordedAt: FIRST_DAY }],
      });
    }

    const rows = await downloadCsv({ cookie });

    expect(rows).toHaveLength(FORMULA_TITLES.length);
    for (const { host, title } of FORMULA_TITLES) {
      const row = rows.find((candidate) => candidate.store === host);
      expect(row?.product, `product cell for ${host}`).toBe(`'${title}`);
    }
    expect(rows.find((row) => row.store === "one.example")?.variant).toBe(`'${TAB_VARIANT}`);
  });
});
