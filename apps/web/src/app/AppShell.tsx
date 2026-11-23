import { useUnit } from "effector-react";
import { CreditCard, Link as LinkIcon, LogOut, TrendingDown, type LucideIcon } from "lucide-react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";

import { $me, $sessionError, $sessionStatus, meRefreshRequested, signOutClicked } from "../session/model";
import { ThemeToggle } from "../shared/ThemeToggle";
import { ErrorState, LoadingState } from "../shared/ui";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  {
    to: "/app",
    label: "Links",
    icon: LinkIcon,
  },
  {
    to: "/app/billing",
    label: "Billing",
    icon: CreditCard,
  },
];

export const RequireSession = () => {
  const { status, error, me } = useUnit({
    status: $sessionStatus,
    error: $sessionError,
    me: $me,
  });

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md p-8">
        <LoadingState />
      </div>
    );
  }
  if (status === "signed_out") {
    return <Navigate to="/sign-in" replace />;
  }
  if (status === "error" || status === "no_account" || !me) {
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={error} onRetry={() => meRefreshRequested()} />
      </div>
    );
  }
  return <Outlet />;
};

export const AppShell = () => {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export const Logo = ({ to }: { to: string }) => {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <TrendingDown className="size-4" />
      </span>
      <span className="text-sm font-semibold">PriceDawn</span>
    </Link>
  );
};

const TopBar = () => {
  const { me } = useUnit({ me: $me });

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-surface/90 sm:gap-4 px-4 py-1.5 backdrop-blur">
      <div className="flex items-center gap-3 sm:gap-6">
        <Logo to="/app" />
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            return <NavButton key={item.to} item={item} />;
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 sm:gap-3">
        <span className="hidden truncate sm:inline">{me?.email}</span>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOutClicked()}
          aria-label="Sign out"
          className="inline-flex size-11 items-center justify-center hover:text-slate-900"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
};

const NavButton = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) => {
        return `flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium sm:px-3 ${isActive ? "bg-brand-50 text-brand-ink" : "text-slate-600 hover:bg-slate-50"}`;
      }}
    >
      <Icon className="hidden size-4 sm:block" />
      {item.label}
    </NavLink>
  );
};
