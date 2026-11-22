import { PRICE_CHECKER_PATH, type PriceCheckDto } from "@price-watch/contract";
import { createEffect, createEvent, createStore, sample } from "effector";

import { apiRequest } from "../shared/api";

export const urlChanged = createEvent<string>();
export const checkSubmitted = createEvent();
export const turnstileSolved = createEvent<string>();
export const turnstileExpired = createEvent();

export const checkPriceFx = createEffect(({ url, token }: { url: string; token: string }) => {
  return apiRequest<PriceCheckDto>({
    path: PRICE_CHECKER_PATH,
    method: "POST",
    headers: { "x-turnstile-token": token },
    body: { url },
  });
});

export const $url = createStore("");
export const $result = createStore<PriceCheckDto | null>(null);
export const $checkError = createStore("");
export const $turnstileToken = createStore("");
// A Turnstile token works once, so every check remounts the widget for a fresh one.
export const $turnstileRound = createStore(0);

// #region bot check
sample({
  clock: turnstileSolved,
  target: $turnstileToken,
});

sample({
  clock: [turnstileExpired, checkPriceFx.finally],
  target: $turnstileToken.reinit,
});

sample({
  clock: checkPriceFx.finally,
  source: $turnstileRound,
  fn: (round) => round + 1,
  target: $turnstileRound,
});
// #endregion

// #region check
sample({
  clock: urlChanged,
  target: $url,
});

sample({
  clock: checkSubmitted,
  source: {
    url: $url,
    token: $turnstileToken,
  },
  fn: ({ url, token }) => ({ url: url.trim(), token }),
  filter: ({ url, token }) => url.trim() !== "" && token !== "",
  target: checkPriceFx,
});

sample({
  clock: checkPriceFx,
  target: [$checkError.reinit, $result.reinit],
});

sample({
  clock: checkPriceFx.doneData,
  target: $result,
});

sample({
  clock: checkPriceFx.failData,
  fn: (error) => error.message,
  target: $checkError,
});
// #endregion
