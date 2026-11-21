import type { MeDto } from "@price-watch/contract";
import { createEffect, createEvent, createStore, sample } from "effector";

import { apiCommand, apiRequest, ApiRequestError } from "../shared/api";

export type SessionStatus = "loading" | "signed_out" | "no_account" | "error" | "ready";

export const appStarted = createEvent();
export const meRefreshRequested = createEvent();
export const signOutClicked = createEvent();

export const meFx = createEffect(async () => {
  // get-session answers 200 null when signed out, so a visitor causes no 401 in the console.
  const session = await apiRequest<{ user: { id: string } } | null>({ path: "/api/auth/get-session" });

  if (!session) {
    throw new ApiRequestError(401, "unauthorized", "Sign in first");
  }
  return apiRequest<MeDto>({ path: "/api/me" });
});

export const signOutFx = createEffect(() => {
  return apiCommand({
    path: "/api/auth/sign-out",
    method: "POST",
    body: {},
  });
});

export const $me = createStore<MeDto | null>(null);
export const $sessionStatus = createStore<SessionStatus>("loading");
export const $sessionError = createStore("");

// #region load
sample({
  clock: [appStarted, meRefreshRequested],
  target: meFx,
});

sample({
  clock: meFx.doneData,
  target: $me,
});

sample({
  clock: meFx.doneData,
  fn: (): SessionStatus => "ready",
  target: $sessionStatus,
});

sample({
  clock: meFx.failData,
  fn: getFailedSessionStatus,
  target: $sessionStatus,
});

sample({
  clock: meFx.failData,
  fn: (error) => error.message,
  target: $sessionError,
});

sample({
  clock: meFx.failData,
  target: $me.reinit,
});
// #endregion

// #region sign out
sample({
  clock: signOutClicked,
  target: signOutFx,
});

sample({
  clock: signOutFx.finally,
  target: $me.reinit,
});

sample({
  clock: signOutFx.finally,
  fn: (): SessionStatus => "signed_out",
  target: $sessionStatus,
});
// #endregion

function getFailedSessionStatus(error: Error): SessionStatus {
  if (!(error instanceof ApiRequestError)) {
    return "error";
  }
  if (error.status === 401) {
    return "signed_out";
  }
  if (error.code === "no_account") {
    return "no_account";
  }
  return "error";
}
