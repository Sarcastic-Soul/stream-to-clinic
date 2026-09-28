"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { DropletsIcon, MenuIcon } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTranslate } from "@/hooks/use-locale";
import { MOCK } from "@/lib/api";
import { cn } from "@/lib/utils";

// A tablet bar keeps the citizen screens, a phone bar only the menu; every page is in the menu.
const LINKS = [
  { href: "/", key: "nav.map" },
  { href: "/report", key: "nav.report" },
  { href: "/clinic", key: "nav.clinic" },
  { href: "/loop", key: "nav.loop" },
  { href: "/trends", key: "nav.trends" },
  { href: "/ask", key: "nav.ask" },
  { href: "/standards", key: "nav.standards" },
] as const;
const PHONE_LINKS = new Set<string>(["/", "/report"]);

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/clinic" && pathname.startsWith("/alerts"));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <DropletsIcon className="size-5 text-sky-600 dark:text-sky-400" aria-hidden />
          <span>Stream-to-Clinic</span>
        </Link>
        {MOCK && (
          <span className="hidden rounded-full bg-amber-100 px-2 sm:inline py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t("nav.demoData")}
          </span>
        )}
        <nav aria-label={t("nav.main")} className="ml-auto">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => {
              const { href, key } = link;
              const active = isActive(href);
              return (
                <li key={href} className={PHONE_LINKS.has(href) ? "hidden sm:block" : "hidden lg:block"}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md px-2 text-sm sm:px-3 font-medium transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <LanguageToggle />
        <ThemeToggle />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label={t("nav.menu")}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
          >
            <MenuIcon className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-4 pt-14">
            <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
            <nav aria-label={t("nav.main")}>
              <ul className="grid gap-1">
                {LINKS.map(({ href, key }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center rounded-lg px-3 text-base font-medium transition-colors hover:bg-accent",
                        isActive(href) ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                      )}
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
