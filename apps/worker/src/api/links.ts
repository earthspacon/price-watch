import type { AddLinksResult } from "@price-watch/contract";

import { HttpError, json, readJson, readString, route, type Route } from "../http";
import { parseProductLink } from "../links/parse";
import { getLinkLimit } from "../repo/accounts";
import { deleteLink, insertLinks, listLinks, type NewLink } from "../repo/links";
import type { ApiContext } from "./context";

const MAX_LINES_PER_PASTE = 1000;
const MAX_PASTE_BYTES = 200 * 1024;
// The JSON envelope around the pasted text.
const BODY_OVERHEAD_BYTES = 64;
const TOO_MANY_LINKS = "Paste at most 1,000 links at once";
const LINE_BREAK = /\r?\n/;
// The byte size is checked after parsing, so the character count needs no cap of its own.
const NO_CHARACTER_LIMIT = Number.MAX_SAFE_INTEGER;

export const linkRoutes: Route<ApiContext>[] = [
  route("GET", "/api/links", async ({ deps, account }) => {
    const limit = getLinkLimit({ account });
    return json(await listLinks({ db: deps.db, accountId: account.accountId, limit: limit > 0 ? limit : null }));
  }),

  route("POST", "/api/links", async ({ deps, account, request }) => {
    const limit = getLinkLimit({ account });
    if (limit === 0) {
      throw new HttpError(403, "no_plan", "Pick a plan to start tracking links");
    }
    if (!(await deps.env.LINKS_LIMITER.limit({ key: account.accountId })).success) {
      throw new HttpError(429, "rate_limited", "Too many pastes. Wait a minute and try again");
    }
    const text = await readPastedText(request);
    const result = await addLinks({ deps, accountId: account.accountId, text, limit });
    return json(result);
  }),

  route("DELETE", "/api/links/:linkId", async ({ deps, account, params }) => {
    const isDeleted = await deleteLink({ db: deps.db, accountId: account.accountId, linkId: params.linkId });
    if (!isDeleted) {
      throw new HttpError(404, "not_found", "Link not found");
    }
    return new Response(null, { status: 204 });
  }),
];

async function readPastedText(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_PASTE_BYTES + BODY_OVERHEAD_BYTES) {
    throw new HttpError(413, "too_large", TOO_MANY_LINKS);
  }
  const data = await readJson(request);
  const text = readString({ data, key: "text", maxLength: NO_CHARACTER_LIMIT });

  if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
    throw new HttpError(413, "too_large", TOO_MANY_LINKS);
  }
  return text;
}

async function addLinks({
  deps,
  accountId,
  text,
  limit,
}: {
  deps: ApiContext["deps"];
  accountId: string;
  text: string;
  limit: number;
}) {
  const lines = text
    .split(LINE_BREAK)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((entry) => entry.text !== "");

  if (lines.length > MAX_LINES_PER_PASTE) {
    throw new HttpError(413, "too_large", TOO_MANY_LINKS);
  }

  const result: AddLinksResult = { added: 0, skipped: [] };
  const valid: Array<{ line: number; text: string; link: NewLink }> = [];
  for (const entry of lines) {
    const parsed = parseProductLink(entry.text);
    if (parsed.ok) {
      valid.push({ ...entry, link: parsed });
    } else {
      result.skipped.push({ ...entry, reason: parsed.reason });
    }
  }

  const outcomes = await insertLinks({
    db: deps.db,
    accountId,
    links: valid.map((entry) => entry.link),
    limit,
    now: deps.now(),
  });
  valid.forEach((entry, index) => {
    const outcome = outcomes[index];
    if (outcome === "added") {
      result.added += 1;
    } else {
      result.skipped.push({ line: entry.line, text: entry.text, reason: outcome });
    }
  });
  result.skipped.sort((first, second) => first.line - second.line);
  return result;
}
