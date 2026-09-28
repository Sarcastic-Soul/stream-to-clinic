"use client";

import { useCallback, type ReactNode } from "react";
import { FhirLink } from "@/components/fhir-link";
import { InfoTip } from "@/components/info-tip";
import { LoadError, LoadingRows } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { useTranslate } from "@/hooks/use-locale";
import { FHIR_URL, api, fhirObservationUrl, siteBundleUrl } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";

// Last two path segments of a FHIR URL, e.g. "DetectedIssue/123".
const resourceLabel = (url: string) => url.split("/").slice(-2).join("/");

/** An info icon with one translated message, for the server-rendered standards page. */
export function StandardsTip({ k, vars, side }: { k: MessageKey; vars?: Record<string, string | number>; side?: "top" | "bottom" | "left" | "right" }) {
  const t = useTranslate();
  return (
    <InfoTip label={t("common.moreInfo")} side={side}>
      {t(k, vars)}
    </InfoTip>
  );
}

function Example({ term, kind, children }: { term: string; kind: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card px-3.5 py-3 sm:last:odd:col-span-2">
      <dt className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{term}</span>
        <span className="font-mono text-[0.7rem] text-muted-foreground">{kind}</span>
      </dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}

// Real resources on the public FHIR server, picked from the API so every link resolves.
export function LiveExamples() {
  const t = useTranslate();
  const { data, error, loading } = useApi(
    useCallback(async () => {
      const [sites, alerts] = await Promise.all([api.getSites(), api.getAlerts()]);
      return { sites, alerts };
    }, []),
  );

  if (loading) return <LoadingRows rows={3} label={t("standards.examples.loading")} />;
  if (error) return <LoadError error={error} what="live examples" />;
  if (!data) return null;

  const site = data.sites[0];
  const latest = data.sites
    .flatMap((s) => s.latest)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const alert = data.alerts.find((a) => a.fhir.communications.length > 0) ?? data.alerts[0];
  const communication = alert?.fhir.communications[0];
  const none = (key: MessageKey) => <p className="text-sm text-muted-foreground">{t(key)}</p>;

  return (
    <dl className="grid gap-2.5 sm:grid-cols-2">
      <Example term={t("standards.examples.site")} kind="LocationOah">
        {site ? <FhirLink href={`${FHIR_URL}/Location/${site.id}`}>Location/{site.id}</FhirLink> : none("standards.examples.noSites")}
      </Example>
      <Example term={t("standards.examples.report")} kind="ObservationIndicatorsOah">
        {latest ? <FhirLink href={fhirObservationUrl(latest.id)}>Observation/{latest.id}</FhirLink> : none("standards.examples.noReports")}
      </Example>
      <Example term={t("standards.examples.cohort")} kind="GroupOah">
        {site ? <FhirLink href={`${FHIR_URL}/Group/cohort-${site.id}`}>Group/cohort-{site.id}</FhirLink> : none("standards.examples.noSites")}
      </Example>
      <Example term={t("standards.examples.alert")} kind="DetectedIssue">
        {alert ? (
          <FhirLink href={alert.fhir.detectedIssue}>{resourceLabel(alert.fhir.detectedIssue)}</FhirLink>
        ) : (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {t("standards.examples.noAlert")}
            <StandardsTip k="standards.examples.noAlertInfo" />
          </p>
        )}
      </Example>
      <Example term={t("standards.examples.message")} kind="Communication">
        {communication ? <FhirLink href={communication}>{resourceLabel(communication)}</FhirLink> : none("standards.examples.noMessage")}
      </Example>
      <Example term={t("standards.examples.trigger")} kind="Subscription">
        <FhirLink href={`${FHIR_URL}/Subscription/citizen-observations`}>Subscription/citizen-observations</FhirLink>
      </Example>
      <Example term={t("standards.examples.bundle")} kind="Bundle">
        {site ? <FhirLink href={siteBundleUrl(site.id)}>{site.id}-bundle.json</FhirLink> : none("standards.examples.noSites")}
      </Example>
    </dl>
  );
}
