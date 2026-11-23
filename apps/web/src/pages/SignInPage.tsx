import { useGate, useUnit } from "effector-react";
import { MailCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { Logo } from "../app/AppShell";
import {
  $email,
  $isGoogleEnabled,
  $sendError,
  $sentTo,
  $turnstileRound,
  $turnstileToken,
  anotherEmailClicked,
  emailChanged,
  googleClicked,
  googleSignInFx,
  sendLinkFx,
  SignInGate,
  signInSubmitted,
  turnstileExpired,
  turnstileSolved,
} from "../session/sign-in-model";
import { TurnstileWidget } from "../shared/TurnstileWidget";
import { Banner, BUTTON_PRIMARY, BUTTON_SECONDARY, Card, INPUT } from "../shared/ui";

export const SignInPage = () => {
  const { sentTo } = useUnit({ sentTo: $sentTo });
  useGate(SignInGate);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo to="/" />
      {sentTo ? <LinkSent email={sentTo} /> : <SignInForm />}
    </div>
  );
};

const SignInForm = () => {
  const { email, error, isGoogleEnabled, isSending, round, token } = useUnit({
    email: $email,
    error: $sendError,
    isGoogleEnabled: $isGoogleEnabled,
    isSending: sendLinkFx.pending,
    round: $turnstileRound,
    token: $turnstileToken,
  });
  const [searchParams] = useSearchParams();
  const linkError = searchParams.get("error");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    signInSubmitted();
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Sign in to PriceDawn</h1>
        <p className="text-sm text-slate-500">
          {isGoogleEnabled
            ? "Use your Google account, or get a sign-in link by email. No password needed."
            : "We email you a sign-in link. No password needed."}
        </p>
      </div>
      {linkError && (
        <Banner tone="warning">That sign-in link expired or was already used. Send a new link below.</Banner>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
      {isGoogleEnabled && <GoogleButton />}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => emailChanged(event.target.value)}
            className={INPUT}
          />
        </label>
        <TurnstileWidget key={round} onSolved={turnstileSolved} onExpired={turnstileExpired} />
        <button type="submit" disabled={isSending || !token} className={`${BUTTON_PRIMARY} w-full`}>
          {isSending ? "Sending…" : linkError ? "Send a new link" : "Email me a sign-in link"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">New here? Same button creates your account.</p>
    </Card>
  );
};

// Email links stay below as the fallback for Microsoft 365 and other mail.
const GoogleButton = () => {
  const { isPending } = useUnit({ isPending: googleSignInFx.pending });

  return (
    <>
      <button
        type="button"
        onClick={() => googleClicked()}
        disabled={isPending}
        className={`${BUTTON_SECONDARY} w-full`}
      >
        <GoogleMark />
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        or with an email link
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </>
  );
};

const GoogleMark = () => {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
};

const LinkSent = ({ email }: { email: string }) => {
  return (
    <Card className="space-y-3 p-6 text-center">
      <MailCheck className="mx-auto size-8 text-brand-ink" />
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="text-sm text-slate-600">
        We sent a sign-in link to <span className="font-medium">{email}</span>. It works once and expires in 15 minutes.
      </p>
      <button type="button" onClick={() => anotherEmailClicked()} className="text-sm font-medium text-brand-ink">
        Use another email
      </button>
    </Card>
  );
};
