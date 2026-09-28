"use client";

import { useLayoutEffect } from "react";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { setLocale, useLocale } from "@/hooks/use-locale";
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, applyLocale, readLocale, translator, type Locale } from "@/lib/i18n";

// A small menu that lists every language by its own name, so a reader who does not know the
// current one can still find theirs.
export function LanguageToggle() {
  const locale = useLocale();
  const t = translator(locale);

  // React's dev-only remount wipes attributes it does not own from <html>.
  useLayoutEffect(() => {
    applyLocale(readLocale());
  }, []);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${t("nav.language")}: ${LOCALE_NAMES[locale]}`}
        title={t("nav.language")}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
      >
        <LanguagesIcon className="size-4" aria-hidden />
        <span aria-hidden>{LOCALE_SHORT[locale]}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-[100]">
          <Menu.Popup className="min-w-40 origin-[var(--transform-origin)] rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Menu.RadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
              {LOCALES.map((option) => (
                <Menu.RadioItem
                  key={option}
                  value={option}
                  lang={option}
                  closeOnClick
                  className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 outline-none select-none data-[highlighted]:bg-muted"
                >
                  <span className="w-6 text-xs font-semibold text-muted-foreground">{LOCALE_SHORT[option]}</span>
                  <span className="flex-1">{LOCALE_NAMES[option]}</span>
                  <Menu.RadioItemIndicator>
                    <CheckIcon className="size-4 text-sky-600 dark:text-sky-400" aria-hidden />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
