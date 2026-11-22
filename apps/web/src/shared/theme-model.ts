import { createEffect, createEvent, createStore, sample } from "effector";

export type Theme = "dark" | "light";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#0d0f12",
  light: "#ffffff",
};

export const themeMounted = createEvent();
export const themeToggled = createEvent();

export const $theme = createStore<Theme>("dark");

const readThemeFx = createEffect((): Theme => {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
});

const applyThemeFx = createEffect((theme: Theme) => {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.theme = theme;
  } catch {
    // Storage can be blocked; the switch still works for this page view.
  }
});

sample({
  clock: themeMounted,
  target: readThemeFx,
});

sample({
  clock: readThemeFx.doneData,
  target: $theme,
});

sample({
  clock: themeToggled,
  source: $theme,
  fn: (theme): Theme => {
    return theme === "light" ? "dark" : "light";
  },
  target: [$theme, applyThemeFx],
});
