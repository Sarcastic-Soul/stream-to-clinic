"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeftIcon, BotIcon, CircleCheckIcon, LeafIcon, StethoscopeIcon } from "lucide-react";
import { Acknowledge } from "@/components/clinic/acknowledge";
import { FhirLink } from "@/components/fhir-link";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { api, fhirObservationUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AlertSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

// Last two path segments of a FHIR URL, e.g. "DetectedIssue/123".
const resourceLabel = (url: string) => url.split("/").slice(-2).join("/");

export function AlertDetail({ id }: { id: string }) {
  // Set when the alert is opened from a clinic dashboard; that clinic can then respond.
  const clinicId = useSearchParams().get("clinic");
  const { data: fetched, error, loading } = useApi(useCallback(() => api.getAlert(id), [id]));
  const clinics = useApi(useMemo(() => (clinicId ? () => api.getClinics() : null), [clinicId]));
  // Replaced in place after a response, so the new acknowledgement shows without a refetch.
  const [responded, setResponded] = useState<AlertSummary | null>(null);
  const alert = responded ?? fetched;
  const clinic = clinics.data?.find((c) => c.id === clinicId);
  const closed = alert?.status === "closed";

  return (
    <div className="space-y-6">
      <Link
        href={clinicId ? `/clinic?clinic=${encodeURIComponent(clinicId)}` : "/clinic"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Clinic alerts
      </Link>

      {loading && <LoadingRows rows={4} label="Loading alert" />}
      {error && <LoadError error={error} what="this alert" />}

      {alert && (
        <article className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">{alert.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className={cn(closed && "opacity-60 grayscale")}>
                <RiskBadge level={alert.level} />
              </span>
              <Link href={`/?site=${encodeURIComponent(alert.siteId)}`} className="font-medium text-foreground underline underline-offset-2">
                {alert.siteName}
              </Link>
              <time dateTime={alert.createdAt}>Raised {formatDateTime(alert.createdAt)}</time>
            </div>
          </header>

          {closed && (
            <p className="flex items-start gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
              <CircleCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">
                  Closed{alert.closedAt && <> on <time dateTime={alert.closedAt}>{formatDateTime(alert.closedAt)}</time></>}
                </span>
                : conditions no longer met. Kept here for the record.
              </span>
            </p>
          )}

          {alert.watchFor ? (
            <section
              aria-labelledby="watch-heading"
              className={cn(
                "rounded-xl border p-4",
                closed ? "text-muted-foreground" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
              )}
            >
              <h2 id="watch-heading" className="mb-1 flex items-center gap-2 font-semibold">
                <StethoscopeIcon className="size-5" aria-hidden />
                {closed ? "What to watch for (while it was active)" : "What to watch for"}
              </h2>
              <p>{alert.watchFor}</p>
            </section>
          ) : (
            <section aria-labelledby="watch-heading" className="rounded-xl border p-4">
              <h2 id="watch-heading" className="mb-1 flex items-center gap-2 font-semibold">
                <LeafIcon className="size-5" aria-hidden />
                Environmental risk only
              </h2>
              <p className="text-muted-foreground">No direct health risk for patients. Shared for awareness of stream conditions.</p>
            </section>
          )}

          <section aria-labelledby="why-heading" className="space-y-2">
            <h2 id="why-heading" className="font-semibold">
              Why this alert was raised
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              {alert.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          {alert.narrative && alert.narrative.length > 0 && (
            <section aria-labelledby="narrative-heading" className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <div className="space-y-1">
                <h2 id="narrative-heading" className="flex items-center gap-2 font-semibold">
                  <BotIcon className="size-5" aria-hidden />
                  How this alert was decided
                </h2>
                <p className="text-sm text-muted-foreground">
                  The risk engine&apos;s own account of each step, from the citizen reports and weather to the alert.
                </p>
              </div>
              <ol className="space-y-3">
                {alert.narrative.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="evidence-heading" className="space-y-2">
            <h2 id="evidence-heading" className="font-semibold">
              Evidence
            </h2>
            <p className="text-sm text-muted-foreground">Citizen observations that triggered this alert, as FHIR resources.</p>
            <ul className="space-y-1">
              {alert.evidence.map((obsId) => (
                <li key={obsId}>
                  <FhirLink href={fhirObservationUrl(obsId)}>Observation/{obsId}</FhirLink>
                </li>
              ))}
            </ul>
          </section>

          <Acknowledge alert={alert} clinic={clinic} onAcknowledged={setResponded} />

          <section aria-labelledby="fhir-heading" className="space-y-2">
            <h2 id="fhir-heading" className="font-semibold">
              FHIR record
            </h2>
            <ul className="space-y-1">
              <li>
                <FhirLink href={alert.fhir.detectedIssue}>{resourceLabel(alert.fhir.detectedIssue)}</FhirLink>
              </li>
              {alert.fhir.communications.map((url) => (
                <li key={url}>
                  <FhirLink href={url}>{resourceLabel(url)}</FhirLink>
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </div>
  );
}
