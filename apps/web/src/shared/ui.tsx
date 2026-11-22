import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50";
export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const BUTTON_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50";
export const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-surface shadow-sm ${className}`}>
      {children}
    </section>
  );
};

export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: ReactNode }) => {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
};

export const LoadingState = ({ label = "Loading…" }: { label?: string }) => {
  return (
    <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </Card>
  );
};

export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => {
  return (
    <Card className="space-y-3 p-8 text-center text-sm">
      <p className="flex items-center justify-center gap-2 font-medium text-rose-800">
        <AlertTriangle className="size-4" />
        {message}
      </p>
      <button type="button" onClick={onRetry} className={BUTTON_SECONDARY}>
        Try again
      </button>
    </Card>
  );
};

export const Banner = ({ tone, children }: { tone: "warning" | "danger" | "info"; children: ReactNode }) => {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${BANNER_TONES[tone]}`}>{children}</div>;
};

export function formatDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatDay(iso: string) {
  return DAY_FORMAT.format(new Date(iso));
}

const BANNER_TONES = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-brand-100 bg-brand-50 text-brand-ink",
};
