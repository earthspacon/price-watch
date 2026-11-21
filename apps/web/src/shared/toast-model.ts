import { createEffect, createEvent, createStore, sample } from "effector";

export type Toast = {
  id: number;
  text: string;
  tone: "success" | "error";
};

const TOAST_MS = 3500;

export const toastShown = createEvent<Omit<Toast, "id">>();

export const $toast = createStore<Toast | null>(null);

const hideToastFx = createEffect(async (id: number) => {
  await new Promise((resolve) => {
    return setTimeout(resolve, TOAST_MS);
  });
  return id;
});

sample({
  clock: toastShown,
  source: $toast,
  fn: (previous, toast) => {
    return {
      ...toast,
      id: (previous?.id ?? 0) + 1,
    };
  },
  target: [$toast, hideToastFx.prepend((toast: Toast) => toast.id)],
});

sample({
  clock: hideToastFx.doneData,
  source: $toast,
  filter: (toast, id) => toast?.id === id,
  target: $toast.reinit,
});
