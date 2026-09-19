// Export of everything known about one site as a FHIR R4 collection Bundle: the site and its water
// body, district cohort and baselines, the clinics serving it, recent citizen reports with their
// photos (Media; the Binary stays a link), and its alerts (active and closed) with their clinic
// Communications.
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { BUNDLE_ID_SYSTEM, OAH_PROFILES, RISK_SYSTEM } from "./oah.js";

export const BUNDLE_WINDOW_DAYS = 30;

// Assembles the Bundle; duplicates (same type and id) are kept once, in first-seen order.
export function toSiteBundle(resources: fhir4.Resource[], now = new Date()): fhir4.Bundle {
  const seen = new Set<string>();
  const entry: fhir4.BundleEntry[] = [];
  for (const resource of resources) {
    const key = `${resource.resourceType}/${resource.id}`;
    if (!resource.id || seen.has(key)) continue;
    seen.add(key);
    entry.push({ fullUrl: `${config.publicFhirUrl}/${key}`, resource: resource as fhir4.FhirResource });
  }
  return {
    resourceType: "Bundle",
    identifier: { system: BUNDLE_ID_SYSTEM, value: randomUUID() },
    type: "collection",
    timestamp: now.toISOString(),
    entry,
  };
}

// Loads the site's resources from HAPI; undefined when the id is not a LocationOah site.
export async function loadSiteBundle(siteId: string, now = new Date()): Promise<fhir4.Bundle | undefined> {
  const location = await fhir.read("Location", siteId);
  if (!location?.meta?.profile?.includes(OAH_PROFILES.location)) return undefined;
  const site = `Location/${siteId}`;
  const cohort = `cohort-${siteId}`;
  const since = new Date(now.getTime() - BUNDLE_WINDOW_DAYS * 24 * 3_600_000).toISOString();
  const parentId = location.partOf?.reference?.match(/^Location\/(.+)$/)?.[1];

  const [parent, group, baselines, services, reports, issues, communications] = await Promise.all([
    parentId ? fhir.read("Location", parentId) : undefined,
    fhir.read("Group", cohort),
    fhir.search("Observation", { subject: site, _profile: OAH_PROFILES.observationHealthMeasure, _count: 100 }),
    fhir.search("HealthcareService", { "coverage-area": site, _include: "HealthcareService:organization", _count: 100 }),
    fhir.search("Observation", {
      subject: site,
      _profile: OAH_PROFILES.observationIndicators,
      date: `ge${since}`,
      _sort: "-date",
      _count: 200,
      _include: "Observation:derived-from",
    }),
    fhir.search("DetectedIssue", { implicated: site, code: `${RISK_SYSTEM}|`, _sort: "-_lastUpdated", _count: 200 }),
    // Alert Communications have the site's district cohort as subject.
    fhir.search("Communication", { subject: `Group/${cohort}`, _sort: "-_lastUpdated", _count: 200 }),
  ]);

  return toSiteBundle(
    [
      location,
      ...(parent ? [parent] : []),
      ...(group ? [group] : []),
      ...baselines.matches,
      ...services.included,
      ...services.matches,
      ...reports.matches,
      ...reports.included.filter((r) => r.resourceType === "Media"),
      ...issues.matches,
      ...communications.matches,
    ],
    now,
  );
}
