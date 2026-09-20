"use client";

import { useLayoutEffect } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { setThemePreference, useThemePreference } from "@/hooks/use-theme";
import { THEME_ORDER, applyTheme, readPreference, type ThemePreference } from "@/lib/theme";

const OPTION: Record<ThemePreference, { Icon: typeof SunIcon; label: string }> = {
  system: { Icon: MonitorIcon, label: "system" },
  light: { Icon: SunIcon, label: "light" },
  dark: { Icon: MoonIcon, label: "dark" },
};

export function ThemeToggle() {
  const preference = useThemePreference();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length];
  const { Icon } = OPTION[preference];

  // React's dev-only remount wipes attributes it does not own from <html>, which
  // clears what the inline script set. Re-apply before paint; no-op in production.
  useLayoutEffect(() => {
    applyTheme(readPreference());
  }, []);

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`Theme: ${OPTION[preference].label}. Switch to ${OPTION[next].label}.`}
      title={`Theme: ${OPTION[preference].label}`}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
