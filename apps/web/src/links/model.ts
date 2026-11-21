import type { AddLinksResult, LinkDto } from "@price-watch/contract";
import { createEffect, createEvent, createStore, sample } from "effector";
import { createGate } from "effector-react";

import { meRefreshRequested } from "../session/model";
import { apiCommand, apiRequest, ApiRequestError } from "../shared/api";
import { createRemote } from "../shared/remote";
import { toastShown } from "../shared/toast-model";

const SAVE_ERROR = "Couldn't add the links. Try again.";
const REMOVE_ERROR = "Couldn't remove the link. Try again.";
// Statuses whose server message tells the user what to change; anything else gets the generic text.
const EXPLAINED_STATUSES = new Set([403, 413, 429]);

export const LinksGate = createGate();

export const pasteChanged = createEvent<string>();
export const addClicked = createEvent();
export const removeConfirmed = createEvent<string>();

export const linksRemote = createRemote<void, LinkDto[]>({
  handler: () => {
    return apiRequest<LinkDto[]>({ path: "/api/links" });
  },
  initial: [],
});

export const addLinksFx = createEffect((text: string) => {
  return apiRequest<AddLinksResult>({
    path: "/api/links",
    method: "POST",
    body: { text },
  });
});

export const removeLinkFx = createEffect((linkId: string) => {
  return apiCommand({
    path: `/api/links/${linkId}`,
    method: "DELETE",
  });
});

export const $text = createStore("");
export const $addResult = createStore<AddLinksResult | null>(null);
export const $addError = createStore("");
// Held back until the list has been reloaded, so "3 links added" never shows above a list that lacks them.
const $savedResult = createStore<AddLinksResult | null>(null);

// #region load
sample({
  clock: LinksGate.open,
  target: linksRemote.fx,
});
// #endregion

// #region add
sample({
  clock: pasteChanged,
  target: $text,
});

sample({
  clock: addClicked,
  source: $text,
  target: addLinksFx,
});

sample({
  clock: addLinksFx,
  target: [$addResult.reinit, $addError.reinit],
});

sample({
  clock: addLinksFx.doneData,
  target: [$savedResult, linksRemote.fx, meRefreshRequested],
});

sample({
  clock: addLinksFx.done,
  target: $text.reinit,
});

sample({
  clock: [linksRemote.fx.done, linksRemote.fx.fail],
  source: $savedResult,
  filter: (result) => result !== null,
  target: [$addResult, $savedResult.reinit],
});

sample({
  clock: addLinksFx.failData,
  fn: (error) => {
    return error instanceof ApiRequestError && EXPLAINED_STATUSES.has(error.status) ? error.message : SAVE_ERROR;
  },
  target: $addError,
});
// #endregion

// #region remove
sample({
  clock: removeConfirmed,
  target: removeLinkFx,
});

sample({
  clock: removeLinkFx.done,
  target: [linksRemote.fx, meRefreshRequested],
});

sample({
  clock: removeLinkFx.fail,
  fn: () => {
    return {
      text: REMOVE_ERROR,
      tone: "error" as const,
    };
  },
  target: toastShown,
});
// #endregion
