import { type FailReason, formatChange } from "@price-watch/contract";

export type DigestChange = {
  storeHost: string;
  title: string | null;
  variantTitle: string | null;
  url: string;
  fromCents: number;
  toCents: number;
};

export type DigestFailure = {
  storeHost: string;
  title: string | null;
  variantTitle: string | null;
  url: string;
  reason: FailReason | null;
};

const FAIL_REASON_TEXT: Record<FailReason, string> = {
  not_shopify: "not a Shopify store",
  unavailable: "product not found",
  blocked: "store blocks checks",
};
const UNKNOWN_FAILURE_TEXT = "couldn't be checked";
const STORE_SEPARATOR = " — ";

// A quiet day (no change and no new failure) returns null, so the caller can skip the send but still close the day.
export function buildDigestMail({
  changes,
  failures,
  appUrl,
}: {
  changes: DigestChange[];
  failures: DigestFailure[];
  appUrl: string;
}) {
  if (changes.length === 0 && failures.length === 0) {
    return null;
  }
  return {
    subject: buildSubject({ changes, failures }),
    text: buildBody({ changes, failures, appUrl }),
  };
}

function buildSubject({ changes, failures }: { changes: DigestChange[]; failures: DigestFailure[] }) {
  if (changes.length > 0) {
    const stores = [...new Set(changes.map((change) => change.storeHost))];
    const where = stores.length === 1 ? stores[0] : counted({ n: stores.length, singular: "store", plural: "stores" });
    return `${counted({ n: changes.length, singular: "price change", plural: "price changes" })} at ${where}`;
  }
  return `${counted({ n: failures.length, singular: "link", plural: "links" })} couldn't be checked`;
}

function buildBody({
  changes,
  failures,
  appUrl,
}: {
  changes: DigestChange[];
  failures: DigestFailure[];
  appUrl: string;
}) {
  const lines: string[] = [];

  for (const [storeHost, group] of groupByStore({ changes })) {
    lines.push(storeHost);
    for (const change of group) {
      lines.push(
        `  ${describeProduct(change)}: ${formatChange({ fromCents: change.fromCents, toCents: change.toCents })}`,
      );
      lines.push(`  ${change.url}`);
    }
  }

  if (failures.length > 0) {
    lines.push("Couldn't check:");
    for (const failure of failures) {
      const reason = failure.reason ? FAIL_REASON_TEXT[failure.reason] : UNKNOWN_FAILURE_TEXT;
      lines.push(`  ${failure.url}${STORE_SEPARATOR}${reason}`);
    }
  }

  lines.push(`Your links: ${appUrl}/app`);
  return lines.join("\n");
}

// Stores A→Z, and inside a store the biggest percent change first.
function groupByStore({ changes }: { changes: DigestChange[] }) {
  const groups = new Map<string, DigestChange[]>();
  for (const change of changes) {
    const group = groups.get(change.storeHost);
    if (group) {
      group.push(change);
    } else {
      groups.set(change.storeHost, [change]);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([storeHost, group]) => {
      return [storeHost, [...group].sort((left, right) => percentChange(right) - percentChange(left))] as const;
    });
}

function percentChange({ fromCents, toCents }: DigestChange) {
  return fromCents === 0 ? 0 : Math.abs(toCents - fromCents) / fromCents;
}

function describeProduct({
  title,
  variantTitle,
  url,
}: {
  title: string | null;
  variantTitle: string | null;
  url: string;
}) {
  const name = title ?? url;
  return variantTitle ? `${name}${STORE_SEPARATOR}${variantTitle}` : name;
}

function counted({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return `${n} ${n === 1 ? singular : plural}`;
}
