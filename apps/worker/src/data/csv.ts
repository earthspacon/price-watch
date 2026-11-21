import { EXPORT_CSV_COLUMNS } from "@price-watch/contract";

export type ExportRow = Record<(typeof EXPORT_CSV_COLUMNS)[number], string>;

const CELL_SEPARATOR = ",";
const LINE_BREAK = "\r\n";
const QUOTE = '"';
const NEUTRALIZING_QUOTE = "'";
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);
const NEEDS_QUOTING = /[",\r\n]/;

// Spreadsheet apps run a cell that starts with one of these as a formula, so the cell gets a leading quote.
export function neutralizeFormula({ cell }: { cell: string }) {
  return FORMULA_PREFIXES.has(cell[0] ?? "") ? `${NEUTRALIZING_QUOTE}${cell}` : cell;
}

// RFC 4180: quote cells with separators, quotes or line breaks, and double the quotes inside.
export function escapeCell({ cell }: { cell: string }) {
  const neutralized = neutralizeFormula({ cell });
  if (!NEEDS_QUOTING.test(neutralized)) {
    return neutralized;
  }
  return `${QUOTE}${neutralized.replaceAll(QUOTE, `${QUOTE}${QUOTE}`)}${QUOTE}`;
}

export function toCsv({ rows }: { rows: ExportRow[] }) {
  const lines = [EXPORT_CSV_COLUMNS.join(CELL_SEPARATOR)];
  for (const row of rows) {
    lines.push(EXPORT_CSV_COLUMNS.map((column) => escapeCell({ cell: row[column] })).join(CELL_SEPARATOR));
  }
  return lines.join(LINE_BREAK);
}
