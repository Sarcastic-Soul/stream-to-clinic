"use client";

import { useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readPreference,
  type Theme,
  type ThemePreference,
} from "@/lib/theme";

// No provider: data-theme on <html> is the single source of truth, and every
// subscriber reads it back. The inline script in the root layout sets it before
// the first paint, so nothing here has to run for the page to look right.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onSystemChange);
  // Another tab changed the preference.
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    observer.disconnect();
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

function onSystemChange() {
  if (readPreference() === "system") applyTheme("system");
  notify();
}

function onStorage(event: StorageEvent) {
  if (event.key === THEME_STORAGE_KEY) {
    applyTheme(readPreference());
    notify();
  }
}

const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: the choice still applies for this page.
  }
  applyTheme(preference);
  notify();
}

/** The painted theme. Matches the server render ("light") until hydration. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light" as const);
}

/** What the user picked, which may be "system". */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system" as const);
}
