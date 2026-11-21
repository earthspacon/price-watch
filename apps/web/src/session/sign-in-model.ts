import { SIGN_IN_OPTIONS_PATH, type SignInOptionsDto } from "@price-watch/contract";
import { createEffect, createEvent, createStore, sample } from "effector";
import { createGate } from "effector-react";

import { apiRequest } from "../shared/api";

const AFTER_SIGN_IN = {
  callbackURL: "/app",
  newUserCallbackURL: "/app/onboarding",
  errorCallbackURL: "/sign-in",
};

export const SignInGate = createGate();
export const googleClicked = createEvent();

export const emailChanged = createEvent<string>();
export const signInSubmitted = createEvent();
export const anotherEmailClicked = createEvent();
export const turnstileSolved = createEvent<string>();
export const turnstileExpired = createEvent();

export const sendLinkFx = createEffect(({ email, token }: { email: string; token: string }) => {
  return apiRequest<{ status: boolean }>({
    path: "/api/auth/sign-in/magic-link",
    method: "POST",
    headers: { "x-turnstile-token": token },
    body: {
      email,
      ...AFTER_SIGN_IN,
    },
  });
});

export const signInOptionsFx = createEffect(() => {
  return apiRequest<SignInOptionsDto>({ path: SIGN_IN_OPTIONS_PATH });
});

// Better Auth answers with Google's consent URL; the browser leaves for Google and comes back via the callback.
export const googleSignInFx = createEffect(async () => {
  const { url } = await apiRequest<{ url: string }>({
    path: "/api/auth/sign-in/social",
    method: "POST",
    body: {
      provider: "google",
      ...AFTER_SIGN_IN,
    },
  });
  window.location.assign(url);
});

export const $isGoogleEnabled = createStore(false);

export const $email = createStore("");
export const $sentTo = createStore("");
export const $sendError = createStore("");
export const $turnstileToken = createStore("");
// A Turnstile token works once, so every send attempt remounts the widget for a fresh one.
export const $turnstileRound = createStore(0);

sample({
  clock: SignInGate.open,
  target: signInOptionsFx,
});

sample({
  clock: signInOptionsFx.doneData,
  fn: ({ google }) => google,
  target: $isGoogleEnabled,
});

sample({
  clock: googleClicked,
  target: googleSignInFx,
});

sample({
  clock: googleSignInFx,
  target: $sendError.reinit,
});

sample({
  clock: googleSignInFx.failData,
  fn: (error) => error.message,
  target: $sendError,
});

sample({
  clock: turnstileSolved,
  target: $turnstileToken,
});

sample({
  clock: [turnstileExpired, sendLinkFx.finally],
  target: $turnstileToken.reinit,
});

sample({
  clock: sendLinkFx.finally,
  source: $turnstileRound,
  fn: (round) => round + 1,
  target: $turnstileRound,
});

sample({
  clock: emailChanged,
  target: $email,
});

sample({
  clock: signInSubmitted,
  source: {
    email: $email,
    token: $turnstileToken,
  },
  fn: ({ email, token }) => ({ email: email.trim(), token }),
  filter: ({ email, token }) => email.trim().includes("@") && token !== "",
  target: sendLinkFx,
});

sample({
  clock: sendLinkFx,
  target: $sendError.reinit,
});

sample({
  clock: sendLinkFx.done,
  fn: ({ params }) => params.email,
  target: $sentTo,
});

sample({
  clock: sendLinkFx.failData,
  fn: (error) => error.message,
  target: $sendError,
});

sample({
  clock: anotherEmailClicked,
  target: $sentTo.reinit,
});
