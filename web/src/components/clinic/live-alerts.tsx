"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DropletsIcon, XIcon } from "lucide-react";
import { useTranslate } from "@/hooks/use-locale";
import type { Arrival } from "@/hooks/use-live-alerts";
import { RISK, alertTitle } from "@/lib/format";
import type { LiveStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<LiveStatus, { dot: string; text: string }> = {
  live: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  connecting: { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300" },
  offline: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

/** Small pill showing whether new alerts will arrive on their own. */
export function LiveIndicator({ status, className }: { status: LiveStatus; className?: string }) {
  const t = useTranslate();
  const s = STATUS[status];
  return (
    <span
      id="live-status"
      data-status={status}
      className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2 py-0.5 text-xs font-medium", s.text, className)}
      title={status === "live" ? t("clinic.live.hint") : undefined}
    >
      <span className="relative flex size-2" aria-hidden>
        {status === "live" && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", s.dot)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", s.dot)} />
      </span>
      {t(`clinic.live.${status}`)}
    </span>
  );
}

/**
 * A notification banner, styled like a phone's, for an alert that just arrived. `inFrame` keeps it
 * inside a positioned parent (the phone mock-up on /loop) instead of the viewport.
 */
export function AlertBanner({
  arrival,
  clinicId,
  onDismiss,
  inFrame = false,
  autoHideMs = 15_000,
}: {
  arrival: Arrival;
  clinicId: string;
  onDismiss: () => void;
  inFrame?: boolean;
  autoHideMs?: number;
}) {
  const t = useTranslate();
  const { alert } = arrival;
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timer);
  }, [arrival, autoHideMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="alert-banner"
      className={cn(
        "z-50 animate-in fade-in slide-in-from-top-8 duration-500",
        inFrame ? "absolute inset-x-2 top-2" : "fixed inset-x-3 top-16 mx-auto max-w-md",
      )}
    >
      <div className="relative flex gap-3 rounded-2xl border border-white/40 bg-white/85 p-3 pr-9 shadow-2xl shadow-sky-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow">
          <DropletsIcon className="size-5" aria-hidden />
        </span>
        <Link href={`/alerts/${encodeURIComponent(alert.id)}?clinic=${encodeURIComponent(clinicId)}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Stream-to-Clinic <span aria-hidden>·</span> {t("clinic.banner.now")}
          </p>
          <p className="flex items-center gap-2 font-semibold">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: RISK[alert.level].color }} aria-hidden />
            <span className="truncate">{alertTitle(t, alert)}</span>
          </p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {alert.siteName}
            {alert.watchFor ? ` · ${t("clinic.banner.watchFor", { text: alert.watchFor })}` : ""}
          </p>
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("clinic.banner.dismiss")}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
