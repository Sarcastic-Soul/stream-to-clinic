// "What happened to my report": everything the system did with one citizen report, read back from
// FHIR. The Observation and its Provenance, every alert (DetectedIssue) that cited it as evidence,
// the clinics each alert was sent to, what they replied, and any advisory drafted for them.
import { isActive, loadCommunications, toAlertSummary, type AlertSummary, type Communications } from "./alerts.js";
import { loadAdvisory, type Advisory } from "./advisory.js";
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { toObservationSummary, type ObservationSummary } from "./mapping.js";
import { OAH_PROFILES, RISK_SYSTEM } from "./oah.js";
import { loadSite } from "./store.js";

export interface JourneyAlert extends AlertSummary {
  notified: { clinicId: string; clinicName: string; at: string; fhirUrl: string }[];
  advisory?: Advisory;
}

export interface ReportJourney {
  report: ObservationSummary;
  site: { id: string; name: string; waterBody: string };
  fhirUrl: string;
  provenance?: { recorded: string; agents: string[]; fhirUrl: string };
  alerts: JourneyAlert[];
}

const publicUrl = (reference: string) => `${config.publicFhirUrl}/${reference}`;

export const citesObservation = (issue: fhir4.DetectedIssue, observationId: string) =>
  (issue.evidence ?? []).some((e) => (e.detail ?? []).some((d) => d.reference === `Observation/${observationId}`));

export function toJourneyAlert(issue: fhir4.DetectedIssue, comms: Communications, advisory?: Advisory): JourneyAlert | undefined {
  const alert = toAlertSummary(issue, comms);
  if (!alert) return undefined;
  const notified = (comms.get(alert.id)?.sent ?? [])
    .map((c) => ({ clinicId: c.clinicId, clinicName: c.clinicName, at: c.at, fhirUrl: publicUrl(`Communication/${c.id}`) }))
    .sort((a, b) => a.at.localeCompare(b.at));
  return { ...alert, notified, ...(advisory ? { advisory } : {}) };
}

export function toJourneyProvenance(provenance: fhir4.Provenance | undefined): ReportJourney["provenance"] {
  if (!provenance?.id) return undefined;
  return {
    recorded: provenance.recorded,
    agents: provenance.agent.flatMap((a) => a.who.display ?? []),
    fhirUrl: publicUrl(`Provenance/${provenance.id}`),
  };
}

// The rule engine rewrites an active alert in place as new reports arrive, so a report that helped
// raise an alert may have dropped out of its current evidence. Every version of each alert at the
// site that was open when the report came in is checked, not just the latest.
async function alertsCiting(siteId: string, observationId: string, since: string): Promise<fhir4.DetectedIssue[]> {
  const { matches } = await fhir.search("DetectedIssue", {
    implicated: `Location/${siteId}`,
    code: `${RISK_SYSTEM}|`,
    _sort: "-_lastUpdated",
    _count: 50,
  });
  const candidates = matches.filter((i) => isActive(i) || (i.identifiedPeriod?.end ?? "") >= since);
  const cited = await Promise.all(
    candidates.map(async (issue) => {
      if (citesObservation(issue, observationId)) return issue;
      const versions = issue.id ? await fhir.history("DetectedIssue", issue.id) : [];
      return versions.some((v) => citesObservation(v, observationId)) ? issue : undefined;
    }),
  );
  return cited.flatMap((i) => i ?? []);
}

export async function loadJourney(observationId: string): Promise<ReportJourney | undefined> {
  const observation = await fhir.read("Observation", observationId);
  if (!observation?.meta?.profile?.includes(OAH_PROFILES.observationIndicators)) return undefined;
  const report = toObservationSummary(observation);
  const siteId = observation.subject?.reference?.replace("Location/", "");
  if (!report || !siteId) return undefined;

  const recordedAt = observation.meta.lastUpdated ?? report.observedAt;
  const [site, provenance, issues, comms] = await Promise.all([
    loadSite(siteId),
    fhir.search("Provenance", { target: `Observation/${observationId}`, _count: 5 }),
    alertsCiting(siteId, observationId, recordedAt),
    loadCommunications(),
  ]);
  const advisories = await Promise.all(issues.map((i) => (i.id ? loadAdvisory(i.id).catch(() => undefined) : undefined)));
  const lineage = toJourneyProvenance(provenance.matches[0]);

  return {
    report,
    site: { id: siteId, name: site?.name ?? siteId, waterBody: site?.waterBody ?? "" },
    fhirUrl: publicUrl(`Observation/${observationId}`),
    ...(lineage ? { provenance: lineage } : {}),
    alerts: issues
      .flatMap((issue, i) => toJourneyAlert(issue, comms, advisories[i]) ?? [])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}
