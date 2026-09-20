"use client";

import { useLayoutEffect } from "react";
import { setLocale, useLocale } from "@/hooks/use-locale";
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, applyLocale, readLocale, translator } from "@/lib/i18n";

// Cycles en → el → it, like the theme toggle: three options do not earn a dropdown,
// and the label always names the language it will switch to.
export function LanguageToggle() {
  const locale = useLocale();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
  const t = translator(locale);

  // React's dev-only remount wipes attributes it does not own from <html>.
  useLayoutEffect(() => {
    applyLocale(readLocale());
  }, []);

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`${t("nav.language")}: ${LOCALE_NAMES[locale]}. → ${LOCALE_NAMES[next]}`}
      title={`${t("nav.language")}: ${LOCALE_NAMES[locale]}`}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span aria-hidden>{LOCALE_SHORT[locale]}</span>
    </button>
  );
}
