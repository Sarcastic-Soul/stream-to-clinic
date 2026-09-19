import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RISK } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LoadError({ error, what }: { error: Error; what: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Could not load {what}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        RISK[level].badge,
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: RISK[level].color }} aria-hidden />
      {RISK[level].label}
    </span>
  );
}
