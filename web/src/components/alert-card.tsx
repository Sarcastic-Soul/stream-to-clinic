import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AlertSummary } from "@/lib/types";
import { RiskBadge } from "./status";

export function AlertCard({ alert, showSite = true }: { alert: AlertSummary; showSite?: boolean }) {
  return (
    <Link
      href={`/alerts/${encodeURIComponent(alert.id)}`}
      className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{alert.title}</span>
          <RiskBadge level={alert.level} />
          {alert.watchFor === "" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Environmental</span>
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
