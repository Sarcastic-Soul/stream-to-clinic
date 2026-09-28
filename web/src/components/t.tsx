"use client";

import { useTranslate } from "@/hooks/use-locale";
import type { MessageKey } from "@/lib/i18n";

/** One translated string, for server components that cannot call the translation hook. */
export function T({ k, vars }: { k: MessageKey; vars?: Record<string, string | number> }) {
  const t = useTranslate();
  return <>{t(k, vars)}</>;
}
