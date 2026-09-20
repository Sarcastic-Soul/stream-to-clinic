"use client";

import { useSyncExternalStore } from "react";
import {
  LOCALE_STORAGE_KEY,
  applyLocale,
  readLocale,
  translator,
  type Locale,
  type Translate,
} from "@/lib/i18n";

// Same shape as use-theme: the lang attribute on <html> is the single source of truth,
// set before the first paint by the inline script in the root layout.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributeFilter: ["lang"] });
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key === LOCALE_STORAGE_KEY) {
    applyLocale(readLocale());
    notify();
  }
}

const getLocale = (): Locale => {
  const lang = document.documentElement.lang;
  return lang === "el" || lang === "it" ? lang : "en";
};

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the choice still applies for this page.
  }
  applyLocale(locale);
  notify();
}

/** The painted locale. Matches the server render ("en") until hydration. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => "en" as const);
}

/** Translation function for the current locale. */
export function useTranslate(): Translate {
  return translator(useLocale());
}
