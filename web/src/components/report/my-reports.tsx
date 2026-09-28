"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import { useTranslate } from "@/hooks/use-locale";
import { formatDateTime } from "@/lib/format";
import { listMyReports, MY_REPORTS_EVENT, type MyReport } from "@/lib/my-reports";

// Cached so useSyncExternalStore sees the same array until the stored list changes.
let cache: { raw: string; list: MyReport[] } | undefined;
function snapshot(): MyReport[] {
  const list = listMyReports();
  const raw = JSON.stringify(list);
  if (cache?.raw !== raw) cache = { raw, list };
  return cache.list;
}
const EMPTY: MyReport[] = [];

function subscribe(listener: () => void) {
  window.addEventListener(MY_REPORTS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(MY_REPORTS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** The reporter's recent reports on this device, each linking to what happened to it. */
export function MyReports({ exclude }: { exclude?: string }) {
  const t = useTranslate();
  const reports = useSyncExternalStore(subscribe, snapshot, () => EMPTY).filter((r) => r.id !== exclude);
  if (reports.length === 0) return null;

  return (
    <section aria-labelledby="my-reports-heading" className="space-y-3" data-testid="my-reports">
      <div className="flex items-baseline gap-2">
        <HistoryIcon className="size-4 self-center text-muted-foreground" aria-hidden />
        <h2 id="my-reports-heading" className="font-semibold">
          {t("journey.recent")}
        </h2>
        <span className="text-xs text-muted-foreground">{t("journey.recentHint")}</span>
      </div>
      <ul className="divide-y rounded-2xl border bg-card">
        {reports.slice(0, 6).map((r) => (
          <li key={r.id}>
            <Link href={`/reports/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t(`indicator.${r.indicator}` as Parameters<typeof t>[0])} · {r.siteName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  <time dateTime={r.observedAt}>{formatDateTime(r.observedAt)}</time> ·{" "}
                  {r.alerts === 0 ? t("journey.noAlerts") : r.alerts === 1 ? t("journey.alertsOne") : t("journey.alertsMany", { count: r.alerts })}
                </span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
