import { isLive, PLANS, type AddLinksResult, type LinkDto } from "@price-watch/contract";
import { useGate, useUnit } from "effector-react";
import { useState } from "react";

import { BillingGate } from "../billing/model";
import { PlanPicker } from "../billing/PlanPicker";
import { SKIP_REASON_CONFIG } from "../links/config";
import { formatCents, formatChange, getLinkStatusLabel } from "../links/lib";
import {
  $addError,
  $addResult,
  $text,
  addClicked,
  addLinksFx,
  LinksGate,
  linksRemote,
  pasteChanged,
  removeConfirmed,
  removeLinkFx,
} from "../links/model";
import { $me } from "../session/model";
import {
  Banner,
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  ErrorState,
  formatDate,
  INPUT,
  LoadingState,
  PageHeader,
} from "../shared/ui";

const EMPTY_STATE = "No links yet. Paste product links from competitor Shopify stores.";
const NO_VALUE = "—";
const URL_SCHEME = /^https:\/\//;
const DIGEST_HOUR_LABEL = "7:00";
const FALLBACK_TIME_ZONE = "UTC";
const EXPORT_PATH = "/api/export.csv";
const TABLE_COLUMNS = ["Product", "Price", "Last change", "Status", "Last checked", ""];

export const LinksPage = () => {
  useGate(LinksGate);
  const { me } = useUnit({ me: $me });
  const hasPlan = me !== null && me.plan !== null && isLive(me.subscription);
  const isFull = me !== null && me.linkCount >= me.linkLimit;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Your links"
          subtitle={
            <>
              <span className="block">{hasPlan ? describeUsage({ me }) : "Pick a plan to start tracking."}</span>
              <span className="block">{describeDigest({ timeZone: me?.timeZone ?? null })}</span>
            </>
          }
        />
        <a href={EXPORT_PATH} download className={BUTTON_SECONDARY}>
          Export CSV
        </a>
      </div>
      {!hasPlan && <PlanSection />}
      <PasteCard isDisabled={!hasPlan || isFull} />
      <LinksList />
    </>
  );
};

const PlanSection = () => {
  useGate(BillingGate);
  return <PlanPicker />;
};

const PasteCard = ({ isDisabled }: { isDisabled: boolean }) => {
  const { text, isAdding, error, result } = useUnit({
    text: $text,
    isAdding: addLinksFx.pending,
    error: $addError,
    result: $addResult,
  });

  return (
    <Card className="space-y-3 p-5">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          addClicked();
        }}
      >
        <label className="block text-sm font-medium">
          Product links
          <textarea
            value={text}
            disabled={isDisabled || isAdding}
            rows={4}
            placeholder="One product link per line"
            className={`${INPUT} disabled:bg-slate-50`}
            onChange={(event) => pasteChanged(event.target.value)}
          />
        </label>
        <button type="submit" disabled={isDisabled || isAdding || text.trim() === ""} className={BUTTON_PRIMARY}>
          {isAdding ? "Adding…" : "Add links"}
        </button>
      </form>
      {error && <Banner tone="danger">{error}</Banner>}
      {result && <AddResult result={result} />}
    </Card>
  );
};

const AddResult = ({ result }: { result: AddLinksResult }) => {
  if (result.skipped.length === 0) {
    return <Banner tone="info">{`${result.added} ${result.added === 1 ? "link" : "links"} added`}</Banner>;
  }
  return (
    <Banner tone="warning">
      <p className="font-medium">{`${result.added} added, ${result.skipped.length} skipped`}</p>
      <ul className="mt-2 space-y-1">
        {result.skipped.map((skipped) => {
          return (
            <li key={skipped.line} className="flex flex-wrap gap-x-2">
              <span>Line {skipped.line}:</span>
              <span className="min-w-0 break-all">{skipped.text}</span>
              <span className="font-medium">{SKIP_REASON_CONFIG[skipped.reason].label}</span>
            </li>
          );
        })}
      </ul>
    </Banner>
  );
};

const LinksList = () => {
  const { links, status, error } = useUnit({
    links: linksRemote.$data,
    status: linksRemote.$status,
    error: linksRemote.$error,
  });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (status === "loading") {
    return <LoadingState />;
  }
  if (status === "error") {
    return <ErrorState message={error} onRetry={() => linksRemote.fx()} />;
  }
  if (links.length === 0) {
    return <Card className="p-8 text-center text-sm text-slate-500">{EMPTY_STATE}</Card>;
  }

  const renderActions = (link: LinkDto) => {
    return (
      <RemoveActions
        isConfirming={confirmingId === link.id}
        onAsk={() => setConfirmingId(link.id)}
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => {
          setConfirmingId(null);
          removeConfirmed(link.id);
        }}
      />
    );
  };

  return (
    <>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              {TABLE_COLUMNS.map((column) => {
                return (
                  <th key={column} scope="col" className="px-4 py-3 font-medium">
                    {column}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {links.map((link) => {
              return (
                <tr key={link.id} className="align-top">
                  <td className="max-w-xs px-4 py-3">
                    <LinkTitle link={link} />
                  </td>
                  <td className="px-4 py-3">{formatPrice(link)}</td>
                  <td className="px-4 py-3">
                    <LinkChange link={link} />
                  </td>
                  <td className="px-4 py-3">
                    <LinkStatusBadge link={link} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatChecked(link)}</td>
                  <td className="px-4 py-3 text-right">{renderActions(link)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <ul className="space-y-3 md:hidden">
        {links.map((link) => {
          return (
            <li key={link.id} className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <LinkTitle link={link} />
              <p className="text-sm font-medium">{formatPrice(link)}</p>
              <LinkChange link={link} />
              <LinkStatusBadge link={link} />
              <p className="text-sm text-slate-600">{formatChecked(link)}</p>
              {renderActions(link)}
            </li>
          );
        })}
      </ul>
    </>
  );
};

const LinkTitle = ({ link }: { link: LinkDto }) => {
  return (
    <div className="min-w-0">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-all font-medium text-brand-700 hover:underline"
      >
        {link.title ?? link.url.replace(URL_SCHEME, "")}
      </a>
      {link.variantTitle && <p className="text-slate-600">{link.variantTitle}</p>}
      <p className="text-xs text-slate-500">{link.storeHost}</p>
    </div>
  );
};

const LinkChange = ({ link }: { link: LinkDto }) => {
  if (link.previousPriceCents === null || link.priceCents === null || link.changedAt === null) {
    return <span className="text-slate-500">{NO_VALUE}</span>;
  }
  return (
    <div>
      <span className="block">{formatChange({ fromCents: link.previousPriceCents, toCents: link.priceCents })}</span>
      <span className="block text-xs text-slate-500">{formatDate(link.changedAt)}</span>
    </div>
  );
};

const LinkStatusBadge = ({ link }: { link: LinkDto }) => {
  const label = getLinkStatusLabel({ status: link.status, failReason: link.failReason });

  if (label === null) {
    return null;
  }
  return <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{label}</span>;
};

const RemoveActions = ({
  isConfirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  isConfirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const isRemoving = useUnit(removeLinkFx.pending);

  if (!isConfirming) {
    return (
      <button type="button" onClick={onAsk} className={BUTTON_SECONDARY}>
        Remove
      </button>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" disabled={isRemoving} onClick={onConfirm} className={BUTTON_DANGER}>
        Yes, remove
      </button>
      <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
        Cancel
      </button>
    </div>
  );
};

function describeUsage({ me }: { me: { linkCount: number; linkLimit: number } }) {
  const usage = `${me.linkCount} of ${me.linkLimit} links.`;
  const isStarterFull = me.linkLimit === PLANS.starter.linkLimit && me.linkCount >= me.linkLimit;

  return isStarterFull ? `${usage} Switch to Pro for ${PLANS.pro.linkLimit.toLocaleString("en-US")}.` : usage;
}

function describeDigest({ timeZone }: { timeZone: string | null }) {
  return `Daily email at ${DIGEST_HOUR_LABEL} (${timeZone ?? FALLBACK_TIME_ZONE})`;
}

function formatPrice(link: LinkDto) {
  return link.priceCents === null ? NO_VALUE : formatCents({ cents: link.priceCents });
}

function formatChecked(link: LinkDto) {
  return link.lastCheckedAt === null ? NO_VALUE : formatDate(link.lastCheckedAt);
}
