"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropletsIcon } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTranslate } from "@/hooks/use-locale";
import { MOCK } from "@/lib/api";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", key: "nav.map" },
  { href: "/report", key: "nav.report" },
  { href: "/clinic", key: "nav.clinic" },
  { href: "/standards", key: "nav.standards" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslate();
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
          <span className="hidden sm:inline">Stream-to-Clinic</span>
          <span className="sr-only sm:hidden">Stream-to-Clinic</span>
        </Link>
        {MOCK && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t("nav.demoData")}
          </span>
        )}
        <nav aria-label={t("nav.main")} className="ml-auto">
          <ul className="flex items-center gap-1">
            {LINKS.map(({ href, key }) => {
              const active = isActive(href);
              return (
                <li key={href}>
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
      </div>
    </header>
  );
}
