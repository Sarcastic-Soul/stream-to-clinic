// Read models built from FHIR searches: sites (LocationOah), clinics and site observations.
import { fhir } from "./fhir.js";
import { toObservationSummary, type ObservationSummary } from "./mapping.js";
import { OAH_PROFILES } from "./oah.js";

export interface Site {
  id: string;
  name: string;
  waterBody: string;
  region: string;
  lat: number;
  lon: number;
}

export interface ClinicSummary {
  id: string;
  name: string;
  city: string;
  siteIds: string[];
}

function toSite(location: fhir4.Location): Site | undefined {
  if (!location.id || !location.position) return undefined;
  return {
    id: location.id,
    name: location.name ?? location.id,
    waterBody: location.partOf?.display ?? "",
    region: location.address?.text ?? "",
    lat: location.position.latitude,
    lon: location.position.longitude,
  };
}

// A site is any Location conforming to LocationOah; parent water bodies are plain Locations.
export async function loadSites(): Promise<Site[]> {
  const { matches } = await fhir.search("Location", { _profile: OAH_PROFILES.location, _count: 100, _sort: "name" });
  return matches.flatMap((l) => toSite(l) ?? []);
}

export async function loadSite(id: string): Promise<Site | undefined> {
  const location = await fhir.read("Location", id);
  return location?.meta?.profile?.includes(OAH_PROFILES.location) ? toSite(location) : undefined;
}

// Citizen indicator observations for a site, newest first.
export async function siteObservations(siteId: string, count = 50, since?: string): Promise<ObservationSummary[]> {
  const { matches } = await fhir.search("Observation", {
    subject: `Location/${siteId}`,
    _profile: OAH_PROFILES.observationIndicators,
    _sort: "-date",
    _count: count,
    ...(since ? { date: `ge${since}` } : {}),
  });
  return matches.flatMap((o) => toObservationSummary(o) ?? []);
}

export function latestPerIndicator(observations: ObservationSummary[]): ObservationSummary[] {
  const seen = new Set<string>();
  return observations.filter((o) => !seen.has(o.indicator) && seen.add(o.indicator));
}

// Clinics are Organizations; the sites each one serves are the coverageArea of its HealthcareService.
export async function loadClinics(): Promise<ClinicSummary[]> {
  const { matches, included } = await fhir.search("HealthcareService", {
    _include: "HealthcareService:organization",
    _count: 100,
  });
  const clinics = new Map<string, ClinicSummary>();
  for (const service of matches) {
    const orgId = service.providedBy?.reference?.replace("Organization/", "");
    const org = included.find((r): r is fhir4.Organization => r.resourceType === "Organization" && r.id === orgId);
    if (!org?.id) continue;
    const clinic = clinics.get(org.id) ?? {
      id: org.id,
      name: org.name ?? org.id,
      city: org.address?.[0]?.city ?? "",
      siteIds: [],
    };
    for (const area of service.coverageArea ?? []) {
      const siteId = area.reference?.replace("Location/", "");
      if (siteId && !clinic.siteIds.includes(siteId)) clinic.siteIds.push(siteId);
    }
    clinics.set(org.id, clinic);
  }
  return [...clinics.values()].sort((a, b) => a.name.localeCompare(b.name));
}
