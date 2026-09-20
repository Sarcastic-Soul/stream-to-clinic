import Link from "next/link";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AlertSummary } from "@/lib/types";
import { RiskBadge } from "./status";

export function AlertCard({
  alert,
  showSite = true,
  clinicId,
}: {
  alert: AlertSummary;
  showSite?: boolean;
  /** Carried into the alert so that clinic can respond to it there. */
  clinicId?: string;
}) {
  const replies = alert.acknowledgements ?? [];
  return (
    <Link
      href={`/alerts/${encodeURIComponent(alert.id)}${clinicId ? `?clinic=${encodeURIComponent(clinicId)}` : ""}`}
      className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{alert.title}</span>
          <RiskBadge level={alert.level} />
          {alert.watchFor === "" && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">Environmental</span>
          )}
          {replies.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
              <CheckIcon className="size-3" aria-hidden />
              Answered
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {showSite && <>{alert.siteName} · </>}
          <time dateTime={alert.createdAt}>{formatDateTime(alert.createdAt)}</time>
        </p>
        {alert.reasons[0] && <p className="line-clamp-2 text-sm">{alert.reasons[0]}</p>}
      </div>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
    </Link>
  );
}
