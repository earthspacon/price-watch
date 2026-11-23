import { useUnit } from "effector-react";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { $theme, themeMounted, themeToggled } from "./theme-model";

export const ThemeToggle = () => {
  const { theme } = useUnit({
    theme: $theme,
  });
  const Icon = theme === "light" ? Moon : Sun;

  useEffect(() => {
    themeMounted();
  }, []);

  return (
    <button
      type="button"
      onClick={() => themeToggled()}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      className="inline-flex size-11 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
};
