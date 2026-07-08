"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** Theme state synced with the `dark` class on <html> (set pre-hydration in
 *  layout). Any component using this hook stays in sync via MutationObserver. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const read = (): Theme =>
      document.documentElement.classList.contains("dark") ? "dark" : "light";
    setThemeState(read());
    const observer = new MutationObserver(() => setThemeState(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("makan_theme", next);
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  return { theme, setTheme, toggle };
}
