"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleCheckIcon, ExternalLinkIcon } from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatValue } from "@/lib/format";
import type { Indicator, ReportResult, SiteSummary } from "@/lib/types";

interface Props {
  report: ReportResult;
  site: SiteSummary;
  indicator?: Indicator;
  onReportAnother: () => void;
}

export function ReportSuccess({ report, site, indicator, onReportAnother }: Props) {
  const { observation, fhirUrl, alerts } = report;
  const clinicAlerts = alerts.filter((a) => a.watchFor !== "").length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2
          ref={(el) => el?.focus()}
          tabIndex={-1}
          className="flex items-center gap-2 text-xl font-semibold outline-none"
        >
          <CircleCheckIcon className="size-6 text-green-600 dark:text-green-400" aria-hidden />
          Report saved
        </h2>
        <p className="text-muted-foreground">Thank you, {observation.reporter}. Your observation is now a standard FHIR resource.</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border p-4 text-sm">
        <dt className="text-muted-foreground">Site</dt>
        <dd className="font-medium">
          {site.name} · {site.waterBody}
        </dd>
        <dt className="text-muted-foreground">{indicator?.display ?? observation.indicator}</dt>
        <dd className="font-medium">{formatValue(observation, indicator)}</dd>
        <dt className="text-muted-foreground">Observed</dt>
        <dd>
          <time dateTime={observation.observedAt}>{formatDateTime(observation.observedAt)}</time>
        </dd>
        {observation.photoUrl && (
          <>
            <dt className="text-muted-foreground">Photo</dt>
            <dd>
              <Image
                src={observation.photoUrl}
                alt={`Photo attached to this ${indicator?.display.toLowerCase() ?? "observation"} report`}
                width={160}
                height={120}
                unoptimized
                crossOrigin="anonymous"
                className="h-30 w-40 rounded-lg border object-cover"
              />
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">FHIR</dt>
        <dd>
          <a href={fhirUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
            Observation/{observation.id}
            <ExternalLinkIcon className="size-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </dd>
      </dl>

      {alerts.length > 0 && (
        <section aria-labelledby="raised-heading" className="space-y-2">
          <h3 id="raised-heading" className="font-medium">
            {alerts.length === 1 ? "This report raised an alert" : `This report raised ${alerts.length} alerts`}
          </h3>
          {clinicAlerts > 0 && <p className="text-sm text-muted-foreground">Clinics serving this site have been notified.</p>}
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} showSite={false} />
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="h-11 sm:flex-1" onClick={onReportAnother}>
          Report another
        </Button>
        <Link href={`/?site=${encodeURIComponent(site.id)}`} className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 sm:flex-1" })}>
          See site on the map
        </Link>
      </div>
    </div>
  );
}
