"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeftIcon, BotIcon, CircleCheckIcon, LeafIcon, StethoscopeIcon } from "lucide-react";
import { Acknowledge } from "@/components/clinic/acknowledge";
import { Advisory } from "@/components/clinic/advisory";
import { FhirLink } from "@/components/fhir-link";
import { InfoTip } from "@/components/info-tip";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { useTranslate } from "@/hooks/use-locale";
import { api, fhirObservationUrl } from "@/lib/api";
import { alertTitle, formatDateTime } from "@/lib/format";
import type { AlertSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

// Last two path segments of a FHIR URL, e.g. "DetectedIssue/123".
const resourceLabel = (url: string) => url.split("/").slice(-2).join("/");

export function AlertDetail({ id }: { id: string }) {
  const t = useTranslate();
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
        {t("clinic.title")}
      </Link>

      {loading && <LoadingRows rows={4} label={t("clinic.loadingAlert")} />}
      {error && <LoadError error={error} />}

      {alert && (
        <article className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">{alertTitle(t, alert)}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className={cn(closed && "opacity-60 grayscale")}>
                <RiskBadge level={alert.level} />
              </span>
              <Link href={`/?site=${encodeURIComponent(alert.siteId)}`} className="font-medium text-foreground underline underline-offset-2">
                {alert.siteName}
              </Link>
              <time dateTime={alert.createdAt}>{t("clinic.detail.raised", { date: formatDateTime(alert.createdAt) })}</time>
            </div>
          </header>

          {closed && (
            <p className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 font-semibold text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
              <CircleCheckIcon className="size-5 shrink-0" aria-hidden />
              {alert.closedAt ? (
                <time dateTime={alert.closedAt}>{t("clinic.detail.closedOn", { date: formatDateTime(alert.closedAt) })}</time>
              ) : (
                t("clinic.detail.closed")
              )}
              <InfoTip label={t("common.moreInfo")}>{t("clinic.detail.closedInfo")}</InfoTip>
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
                {closed ? t("clinic.detail.watchForClosed") : t("clinic.detail.watchFor")}
              </h2>
              <p>{alert.watchFor}</p>
            </section>
          ) : (
            <section aria-labelledby="watch-heading" className="rounded-xl border p-4">
              <h2 id="watch-heading" className="mb-1 flex items-center gap-2 font-semibold">
                <LeafIcon className="size-5" aria-hidden />
                {t("clinic.detail.envOnly")}
              </h2>
              <p className="text-muted-foreground">{t("clinic.detail.envOnlyText")}</p>
            </section>
          )}

          <section aria-labelledby="why-heading" className="space-y-2">
            <h2 id="why-heading" className="font-semibold">
              {t("clinic.detail.why")}
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              {alert.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          {alert.narrative && alert.narrative.length > 0 && (
            <section aria-labelledby="narrative-heading" className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <h2 id="narrative-heading" className="flex items-center gap-2 font-semibold">
                  <BotIcon className="size-5" aria-hidden />
                  {t("clinic.detail.howDecided")}
                </h2>
                <InfoTip label={t("common.moreInfo")}>{t("clinic.detail.howDecidedInfo")}</InfoTip>
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
            <div className="flex items-center gap-2">
              <h2 id="evidence-heading" className="font-semibold">
                {t("clinic.detail.evidence")}
              </h2>
              <InfoTip label={t("common.moreInfo")}>{t("clinic.detail.evidenceInfo")}</InfoTip>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {alert.evidence.map((obsId) => (
                <li key={obsId}>
                  <FhirLink href={fhirObservationUrl(obsId)}>Observation/{obsId}</FhirLink>
                </li>
              ))}
            </ul>
          </section>

          <Advisory alert={alert} />

          <Acknowledge alert={alert} clinic={clinic} onAcknowledged={setResponded} />

          <section aria-labelledby="fhir-heading" className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 id="fhir-heading" className="font-semibold">
                {t("clinic.detail.fhirRecord")}
              </h2>
              <InfoTip label={t("common.moreInfo")}>{t("clinic.detail.fhirRecordInfo")}</InfoTip>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
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
