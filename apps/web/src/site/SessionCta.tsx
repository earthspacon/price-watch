import { useUnit } from "effector-react";

import { $isSignedIn } from "../session/model";

export const DASHBOARD_PATH = "/app";
export const SIGN_IN_PATH = "/sign-in";
export const DASHBOARD_LABEL = "Open dashboard";

// Both labels stay in the grid cell, the hidden one keeps the width, so the session check never moves the header.
export const SwapLabel = ({ isOn, on, off }: { isOn: boolean; on: string; off: string }) => {
  return (
    <span className="inline-grid justify-items-center">
      <span className={`col-start-1 row-start-1 ${isOn ? "invisible" : ""}`} aria-hidden={isOn}>
        {off}
      </span>
      <span className={`col-start-1 row-start-1 ${isOn ? "" : "invisible"}`} aria-hidden={!isOn}>
        {on}
      </span>
    </span>
  );
};

export const SessionCta = ({ label, className }: { label: string; className: string }) => {
  const { isSignedIn } = useUnit({ isSignedIn: $isSignedIn });

  return (
    <a href={isSignedIn ? DASHBOARD_PATH : SIGN_IN_PATH} className={className}>
      <SwapLabel isOn={isSignedIn} on={DASHBOARD_LABEL} off={label} />
    </a>
  );
};

export const SignInLink = ({ className }: { className: string }) => {
  const { isSignedIn } = useUnit({ isSignedIn: $isSignedIn });

  return (
    <a
      href={SIGN_IN_PATH}
      aria-hidden={isSignedIn}
      tabIndex={isSignedIn ? -1 : undefined}
      className={`${className} ${isSignedIn ? "invisible" : ""}`}
    >
      Sign in
    </a>
  );
};
