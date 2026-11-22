import type { ReactNode } from "react";

import { ThemeToggle } from "../shared/ThemeToggle";
import { SITE_BRAND, SITE_NAME } from "./config";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/pricing",
    label: "Pricing",
  },
  {
    href: "/prisync-alternative",
    label: "Compare",
  },
  {
    href: "/track-shopify-competitor-prices",
    label: "Guide",
  },
];

const FOOTER_ITEMS: readonly NavItem[] = [
  {
    href: "/pricing",
    label: "Pricing",
  },
  {
    href: "/tools/shopify-price-checker",
    label: "Free price checker",
  },
  {
    href: "/terms",
    label: "Terms",
  },
  {
    href: "/privacy",
    label: "Privacy",
  },
  {
    href: "/refunds",
    label: "Refunds",
  },
];

export const SiteLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <a href="/" className="text-lg font-semibold tracking-tight text-brand-ink">
            {SITE_NAME}
          </a>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => {
              return (
                <a key={item.href} href={item.href} className="hover:text-slate-900">
                  {item.label}
                </a>
              );
            })}
            <ThemeToggle />
            <a
              href="/sign-in"
              className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>{`${SITE_NAME}, a ${SITE_BRAND} product.`}</p>
          <nav className="flex flex-wrap gap-4">
            {FOOTER_ITEMS.map((item) => {
              return (
                <a key={item.href} href={item.href} className="hover:text-slate-900">
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </footer>
    </div>
  );
};
