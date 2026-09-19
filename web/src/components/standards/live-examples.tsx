"use client";

import { useCallback, type ReactNode } from "react";
import { FhirLink } from "@/components/fhir-link";
import { LoadError, LoadingRows } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { FHIR_URL, api, fhirObservationUrl, siteBundleUrl } from "@/lib/api";

// Last two path segments of a FHIR URL, e.g. "DetectedIssue/123".
const resourceLabel = (url: string) => url.split("/").slice(-2).join("/");

function Example({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="space-y-1 border-b py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// Real resources on the public FHIR server, picked from the API so every link resolves.
export function LiveExamples() {
  const { data, error, loading } = useApi(
    useCallback(async () => {
      const [sites, alerts] = await Promise.all([api.getSites(), api.getAlerts()]);
      return { sites, alerts };
    }, []),
  );

  if (loading) return <LoadingRows rows={3} label="Loading live examples" />;
  if (error) return <LoadError error={error} what="live examples" />;
  if (!data) return null;

  const site = data.sites[0];
  const latest = data.sites
    .flatMap((s) => s.latest)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const alert = data.alerts.find((a) => a.fhir.communications.length > 0) ?? data.alerts[0];
  const communication = alert?.fhir.communications[0];
  const none = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>;

  return (
    <dl className="rounded-lg border px-4">
      <Example term="Stream site (LocationOah)">
        {site ? <FhirLink href={`${FHIR_URL}/Location/${site.id}`}>Location/{site.id}</FhirLink> : none("No sites loaded yet.")}
      </Example>
      <Example term="Most recent citizen report (ObservationIndicatorsOah)">
        {latest ? <FhirLink href={fhirObservationUrl(latest.id)}>Observation/{latest.id}</FhirLink> : none("No reports yet.")}
      </Example>
      <Example term="District cohort (GroupOah)">
        {site ? <FhirLink href={`${FHIR_URL}/Group/cohort-${site.id}`}>Group/cohort-{site.id}</FhirLink> : none("No sites loaded yet.")}
      </Example>
      <Example term="Health alert (DetectedIssue)">
        {alert ? (
          <FhirLink href={alert.fhir.detectedIssue}>{resourceLabel(alert.fhir.detectedIssue)}</FhirLink>
        ) : (
          none("No active alert right now. One appears as soon as a risk rule fires; see the map.")
        )}
      </Example>
      <Example term="Message to a clinic (Communication)">
        {communication ? (
          <FhirLink href={communication}>{resourceLabel(communication)}</FhirLink>
        ) : (
          none("No clinic has been messaged about an active alert right now.")
        )}
      </Example>
      <Example term="Observation trigger (Subscription)">
        <FhirLink href={`${FHIR_URL}/Subscription/citizen-observations`}>Subscription/citizen-observations</FhirLink>
      </Example>
      <Example term="Everything about one site (Bundle download)">
        {site ? <FhirLink href={siteBundleUrl(site.id)}>{site.id}-bundle.json</FhirLink> : none("No sites loaded yet.")}
      </Example>
    </dl>
  );
}
