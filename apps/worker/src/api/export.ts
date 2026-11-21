import { formatCents } from "@price-watch/contract";

import { toCsv, type ExportRow } from "../data/csv";
import { route, type Route } from "../http";
import type { ApiContext } from "./context";

const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";
const CSV_FILE_NAME = "pricedawn-history.csv";
const PERCENT_DIGITS = 1;

type PriceHistoryRow = {
  store_host: string;
  title: string | null;
  variant_title: string | null;
  url: string;
  price_cents: number;
  previous_cents: number | null;
  recorded_at: string;
};

export const exportRoutes: Route<ApiContext>[] = [
  route("GET", "/api/export.csv", async ({ deps, account }) => {
    const { results } = await deps.db
      .prepare(
        `SELECT l.store_host, l.title, l.variant_title, l.url,
                p.price_cents, p.previous_cents, p.recorded_at
         FROM price_points p
         JOIN links l ON l.id = p.link_id
         WHERE p.account_id = ?1
         ORDER BY p.recorded_at, l.store_host, l.url`,
      )
      .bind(account.accountId)
      .all<PriceHistoryRow>();

    const rows = results.map((row) => toExportRow({ row }));
    return new Response(toCsv({ rows }), {
      status: 200,
      headers: {
        "content-type": CSV_CONTENT_TYPE,
        "content-disposition": `attachment; filename="${CSV_FILE_NAME}"`,
      },
    });
  }),
];

function toExportRow({ row }: { row: PriceHistoryRow }): ExportRow {
  const change = describeChange({ priceCents: row.price_cents, previousCents: row.previous_cents });

  return {
    store: row.store_host,
    product: row.title ?? "",
    variant: row.variant_title ?? "",
    url: row.url,
    price: formatCents({ cents: row.price_cents }),
    previous_price: row.previous_cents === null ? "" : formatCents({ cents: row.previous_cents }),
    change: change.amount,
    change_percent: change.percent,
    recorded_at: row.recorded_at,
  };
}

function describeChange({ priceCents, previousCents }: { priceCents: number; previousCents: number | null }) {
  if (previousCents === null) {
    return { amount: "", percent: "" };
  }
  const difference = priceCents - previousCents;
  const sign = difference < 0 ? "-" : "";
  const amount = `${sign}${formatCents({ cents: Math.abs(difference) })}`;
  const percent =
    previousCents === 0 ? "" : `${sign}${((Math.abs(difference) / previousCents) * 100).toFixed(PERCENT_DIGITS)}%`;

  return { amount, percent };
}
