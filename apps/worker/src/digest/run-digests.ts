import type { Deps } from "../deps";
import { DEFAULT_TIME_ZONE, localDateTime } from "../links/schedule";
import {
  type DigestAccount,
  listDigestAccounts,
  loadDigestChanges,
  loadDigestFailures,
  markDigestSent,
} from "../repo/accounts";
import { buildDigestMail } from "./build";

const DIGEST_HOUR = 7;

// The hourly cron's run: one mail per account whose local clock has reached 7:00 and whose local day is new.
export async function runDigests({ deps, now }: { deps: Deps; now: Date }) {
  const accounts = await listDigestAccounts({ db: deps.db });
  let sent = 0;

  for (const account of accounts) {
    const local = localDateTime({ now, timeZone: account.timeZone ?? DEFAULT_TIME_ZONE });
    if (!isDigestDue({ account, local })) {
      continue;
    }
    const [changes, failures] = await Promise.all([
      loadDigestChanges({ db: deps.db, accountId: account.accountId, since: account.digestCursor }),
      loadDigestFailures({ db: deps.db, accountId: account.accountId, since: account.digestCursor }),
    ]);
    const mail = buildDigestMail({ changes, failures, appUrl: deps.env.APP_URL });

    if (mail) {
      try {
        await deps.mailer.send({ to: account.email, subject: mail.subject, text: mail.text });
      } catch {
        // A provider that is down or over quota: the account stays unmarked, so the next run retries it.
        continue;
      }
      sent++;
    }
    await markDigestSent({ db: deps.db, accountId: account.accountId, localDate: local.date, now });
  }

  return sent;
}

function isDigestDue({ account, local }: { account: DigestAccount; local: { date: string; hour: number } }) {
  return local.hour >= DIGEST_HOUR && (account.lastDigestOn === null || account.lastDigestOn < local.date);
}
