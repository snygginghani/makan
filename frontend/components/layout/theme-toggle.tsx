"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useLang();
  const label = theme === "dark" ? t("lightMode") : t("darkMode");
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  );
}
