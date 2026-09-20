// Demo data (docs/PLAN.md Stage 1), written as one FHIR transaction of PUTs with fixed ids, so it is
// safe to rerun and rebuilds everything after a database loss. Sites are the European monitoring
// locations from the OAH IG examples; clinics, cohorts, baselines and history are synthetic
// and tagged HTEST.
import { advisorDevice } from "./advisory.js";
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { toOahObservation } from "./mapping.js";
import { ACK_ACTIONS } from "./alerts.js";
import {
  ACK_SYSTEM,
  CITIZEN_INDICATORS,
  CLINIC_ID_SYSTEM,
  DEMO_TAG,
  HEALTH_MEASURES,
  OAH_CODE_SYSTEM,
  OAH_LOCATION_ID_SYSTEM,
  OAH_PROFILES,
  PRESENCE_SYSTEM,
  RISK_SYSTEM,
  UCUM,
  type CitizenIndicator,
  type Presence,
} from "./oah.js";
import { RISKS } from "./rules.js";

const SNOMED = "http://snomed.info/sct";
const RIVER = { coding: [{ system: SNOMED, code: "420531007", display: "River" }] };

// Parent water bodies. Almyros and Giofyros are IG examples; Calore is the river through Benevento.
const WATER_BODIES = [
  { id: "Almyros", identifier: "almyros", name: "Almyros", display: "Almyros Stream", description: "Almyros Stream, Crete, Greece" },
  { id: "Giofyros", identifier: "giofyros", name: "Giofyros", display: "Giofyros River", description: "Giofyros River, Crete, Greece" },
  { id: "Calore", identifier: "calore", name: "Calore", display: "Calore River", description: "Calore River, Campania, Italy" },
];

// Monitoring sites, with ids, identifiers, names and coordinates from the OAH IG examples.
export const SITES = [
  {
    id: "Loc-Almyros", identifier: "almyros-1", name: "Almyros monitoring reach",
    description: "Coastal stream segment sampled for OAH monitoring",
    lat: 35.33399, lon: 25.04834, parent: "Almyros", region: "Crete, Greece", state: "Crete", country: "GR",
  },
  {
    id: "Loc-Giofyros", identifier: "giofyros-1", name: "Giofyros monitoring reach",
    description: "Urban stream segment sampled for OAH monitoring",
    lat: 35.32135, lon: 25.10592, parent: "Giofyros", region: "Crete, Greece", state: "Crete", country: "GR",
  },
  {
    id: "Loc-Giofyros-LowerReach", identifier: "giofyros-2", name: "Giofyros monitoring reach (lower)",
    description: "Downstream Giofyros segment sampled for OAH monitoring",
    lat: 35.2623, lon: 25.10458, parent: "Giofyros", region: "Crete, Greece", state: "Crete", country: "GR",
  },
  {
    id: "Loc-Benevento", identifier: "benevento", name: "Benevento",
    description: "City of Benevento (Campania, IT)",
    lat: 41.13, lon: 14.78, parent: "Calore", region: "Campania, Italy", state: "Campania", country: "IT",
  },
] as const;

type SiteId = (typeof SITES)[number]["id"];

// Fictional clinics. Names end in "(demo)" and must not imitate real facilities.
const CLINICS: { id: string; name: string; city: string; country: string; sites: SiteId[] }[] = [
  { id: "clinic-almyros", name: "Almyros Primary Care Unit (demo)", city: "Gazi", country: "GR", sites: ["Loc-Almyros"] },
  {
    id: "clinic-heraklion-west", name: "Heraklion West Family Health Clinic (demo)", city: "Heraklion", country: "GR",
    sites: ["Loc-Almyros", "Loc-Giofyros", "Loc-Giofyros-LowerReach"],
  },
  { id: "clinic-giofyros-valley", name: "Giofyros Valley Health Post (demo)", city: "Heraklion", country: "GR", sites: ["Loc-Giofyros-LowerReach"] },
  { id: "clinic-benevento", name: "Benevento Riverside Community Clinic (demo)", city: "Benevento", country: "IT", sites: ["Loc-Benevento"] },
];

// Synthetic district baselines (% of residents, previous calendar year).
const BASELINES: Record<SiteId, Record<keyof typeof HEALTH_MEASURES, number>> = {
  "Loc-Almyros": { gastrointestinal: 4.8, campylobacter: 0.04 },
  "Loc-Giofyros": { gastrointestinal: 5.6, campylobacter: 0.05 },
  "Loc-Giofyros-LowerReach": { gastrointestinal: 6.1, campylobacter: 0.06 },
  "Loc-Benevento": { gastrointestinal: 3.9, campylobacter: 0.03 },
};

type QuantityId = { [K in CitizenIndicator]: (typeof CITIZEN_INDICATORS)[K]["kind"] extends "quantity" ? K : never }[CitizenIndicator];
type PresenceId = Exclude<CitizenIndicator, QuantityId>;

// Plausible ranges for the synthetic citizen history, plus the chance each presence indicator is seen.
// `drift` is the total change applied across the window (oldest visit to newest), so a site can
// show a direction rather than noise: the trend view is built on it.
const HISTORY: Record<
  SiteId,
  {
    ranges: Record<QuantityId, [number, number]>;
    seen: Record<PresenceId, number>;
    drift?: Partial<Record<QuantityId, number>>;
    latest?: Partial<Record<QuantityId, number>>;
  }
> = {
  "Loc-Almyros": {
    ranges: { waterTemperature: [21.5, 23.5], pH: [7.6, 8.1], dissolvedO2: [7, 8.4], conductivity: [2400, 3200] },
    seen: { foam: 0, filamentousAlgae: 0, diptera: 0.2 },
  },
  "Loc-Giofyros": {
    ranges: { waterTemperature: [19.5, 22], pH: [7.4, 7.9], dissolvedO2: [6.2, 7.6], conductivity: [780, 980] },
    seen: { foam: 0.15, filamentousAlgae: 0, diptera: 0.3 },
  },
  "Loc-Giofyros-LowerReach": {
    ranges: { waterTemperature: [21, 23.5], pH: [7.2, 7.7], dissolvedO2: [4.2, 5.2], conductivity: [950, 1200] },
    seen: { foam: 0.1, filamentousAlgae: 0, diptera: 0.5 },
    // The reach warms and loses oxygen over the window: the trend view shows where to look first.
    drift: { dissolvedO2: -1.8, waterTemperature: 2, conductivity: 400 },
    latest: { dissolvedO2: 3.7 }, // the newest reading, low enough for an environmental alert
  },
  "Loc-Benevento": {
    ranges: { waterTemperature: [16, 18.5], pH: [7.8, 8.2], dissolvedO2: [8.2, 9.4], conductivity: [520, 680] },
    seen: { foam: 0, filamentousAlgae: 0, diptera: 0.1 },
  },
};

const HISTORY_DAYS = 28;
const VISIT_EVERY_DAYS = 1;
const VOLUNTEER = "OAH citizen volunteer (demo)";

// Deterministic pseudo-random number in [0, 1) from a string (FNV-1a), so reruns write identical resources.
function random(seed: string): number {
  let hash = 0x811c9dc5;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0) / 2 ** 32;
}

const tagged = <T extends fhir4.Resource>(resource: T): T => ({
  ...resource,
  meta: { ...resource.meta, tag: [DEMO_TAG] },
});

function codeSystems(): fhir4.CodeSystem[] {
  const base = { resourceType: "CodeSystem", status: "active", content: "complete", experimental: true } as const;
  return [
    {
      ...base, id: "presence", url: PRESENCE_SYSTEM, name: "Presence", title: "Presence of a visual stream indicator",
      concept: [
        { code: "absent", display: "Absent" },
        { code: "present", display: "Present" },
        { code: "abundant", display: "Abundant" },
      ],
    },
    {
      ...base, id: "water-health-risk", url: RISK_SYSTEM, name: "WaterHealthRisk", title: "Water-related health risks raised by Stream-to-Clinic",
      concept: Object.entries(RISKS).map(([code, { title }]) => ({ code, display: title })),
    },
    {
      ...base, id: "alert-response", url: ACK_SYSTEM, name: "AlertResponse", title: "What a clinic did about an alert",
      concept: Object.entries(ACK_ACTIONS).map(([code, display]) => ({ code, display })),
    },
  ];
}

function locations(): fhir4.Location[] {
  const parents = WATER_BODIES.map<fhir4.Location>((w) => ({
    resourceType: "Location",
    id: w.id,
    identifier: [{ system: OAH_LOCATION_ID_SYSTEM, value: w.identifier }],
    name: w.name,
    description: w.description,
    mode: "instance",
    type: [RIVER],
  }));
  const sites = SITES.map<fhir4.Location>((s) => ({
    resourceType: "Location",
    id: s.id,
    meta: { profile: [OAH_PROFILES.location] },
    identifier: [{ system: OAH_LOCATION_ID_SYSTEM, value: s.identifier }],
    name: s.name,
    description: s.description,
    mode: "instance",
    type: [s.id === "Loc-Benevento" ? { coding: [{ system: SNOMED, code: "288520005", display: "City environment" }] } : RIVER],
    address: { text: s.region, state: s.state, country: s.country },
    position: { latitude: s.lat, longitude: s.lon },
    partOf: { reference: `Location/${s.parent}`, display: WATER_BODIES.find((w) => w.id === s.parent)?.display },
  }));
  return [...parents, ...sites];
}

function clinics(): fhir4.Resource[] {
  return CLINICS.flatMap((c) => [
    tagged<fhir4.Organization>({
      resourceType: "Organization",
      id: c.id,
      identifier: [{ system: CLINIC_ID_SYSTEM, value: c.id }],
      active: true,
      type: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/organization-type", code: "prov", display: "Healthcare Provider" }] }],
      name: c.name,
      address: [{ city: c.city, country: c.country }],
    }),
    // The sites a clinic serves are the coverage area of its primary care service.
    tagged<fhir4.HealthcareService>({
      resourceType: "HealthcareService",
      id: `service-${c.id}`,
      active: true,
      providedBy: { reference: `Organization/${c.id}`, display: c.name },
      name: "Primary care",
      coverageArea: c.sites.map((id) => ({ reference: `Location/${id}` })),
    }),
  ]);
}

// One GroupOah cohort per site (residents living near it), modelled on the IG disease-prevalence groups.
function cohorts(): fhir4.Group[] {
  return SITES.map((s) =>
    tagged<fhir4.Group>({
      resourceType: "Group",
      id: `cohort-${s.id}`,
      meta: { profile: [OAH_PROFILES.group] },
      type: "person",
      actual: false,
      name: `Residents near ${s.name} (demo cohort)`,
      characteristic: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "30525-0", display: "Age" }] },
          valueRange: { low: { value: 0, unit: "years", system: UCUM, code: "a" } },
          exclude: false,
        },
        {
          code: { coding: [{ system: SNOMED, code: "20733006", display: "Living place" }] },
          valueReference: { reference: `Location/${s.id}` },
          exclude: false,
        },
      ],
    }),
  );
}

function baselines(year: number): fhir4.Observation[] {
  return SITES.flatMap((s) =>
    Object.entries(HEALTH_MEASURES).map(([code, display]) =>
      tagged<fhir4.Observation>({
        resourceType: "Observation",
        id: `baseline-${s.id}-${code}`,
        meta: { profile: [OAH_PROFILES.observationHealthMeasure] },
        status: "final",
        code: { coding: [{ system: OAH_CODE_SYSTEM, code, display }] },
        subject: { reference: `Location/${s.id}` },
        focus: [{ reference: `Group/cohort-${s.id}` }],
        effectivePeriod: { start: `${year}-01-01`, end: `${year}-12-31` },
        valueQuantity: { value: BASELINES[s.id][code as keyof typeof HEALTH_MEASURES], unit: "%", system: UCUM, code: "%" },
      }),
    ),
  );
}

// A citizen visit per day for the last four weeks, dated relative to `now`. Ids are fixed per
// site, indicator and day, so reseeding rewrites the same resources rather than piling up new ones.
export function history(now: Date): fhir4.Observation[] {
  const observations: fhir4.Observation[] = [];
  for (const site of SITES) {
    const profile = HISTORY[site.id];
    for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 1; daysAgo -= VISIT_EVERY_DAYS) {
      const date = new Date(now.getTime() - daysAgo * 86_400_000);
      date.setUTCHours(8, 30, 0, 0);
      const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
      const isLatest = daysAgo === 1;

      for (const indicator of Object.keys(CITIZEN_INDICATORS) as CitizenIndicator[]) {
        const id = `seed-${site.id}-${indicator}-${stamp}`;
        const r = random(id);
        let value: number | Presence;
        if (indicator in profile.ranges) {
          const key = indicator as QuantityId;
          const [lo, hi] = profile.ranges[key];
          const decimals = key === "conductivity" ? 0 : key === "pH" ? 2 : 1;
          // 0 at the oldest visit, 1 at the newest.
          const progress = (HISTORY_DAYS - 1 - daysAgo) / (HISTORY_DAYS - 2);
          const drifted = lo + (hi - lo) * r + (profile.drift?.[key] ?? 0) * progress;
          value = (isLatest ? profile.latest?.[key] : undefined) ?? Number(drifted.toFixed(decimals));
        } else {
          value = r < profile.seen[indicator as PresenceId] ? "present" : "absent";
        }
        observations.push(
          tagged({
            ...toOahObservation({ siteId: site.id, indicator, value, observedAt: date.toISOString(), reporter: VOLUNTEER }),
            id,
          }),
        );
      }
    }
  }
  return observations;
}

// Rest-hook Subscription: HAPI notifies the API of every citizen indicator Observation, including
// ones written straight to FHIR by other systems, and the API re-evaluates that site's risks.
// With a payload, HAPI delivers each match as PUT {endpoint}/Observation/{id}.
export function subscription(): fhir4.Subscription {
  return {
    resourceType: "Subscription",
    id: "citizen-observations",
    status: "active",
    reason: "Re-evaluate stream health risks when a citizen indicator Observation is created or updated",
    criteria: `Observation?_profile=${OAH_PROFILES.observationIndicators}`,
    channel: { type: "rest-hook", endpoint: config.hookUrl, payload: "application/fhir+json" },
  };
}

export function seedBundle(now = new Date()): fhir4.Bundle {
  const resources: fhir4.Resource[] = [
    ...codeSystems(),
    ...locations(),
    ...clinics(),
    ...cohorts(),
    ...baselines(now.getUTCFullYear() - 1),
    ...history(now),
    tagged(advisorDevice(config.geminiModel)),
    subscription(),
  ];
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: resources.map((resource) => ({
      resource,
      request: { method: "PUT", url: `${resource.resourceType}/${resource.id}` },
    })),
  };
}

// Four weeks of history is more than one transaction should carry on a small host, so the seed is
// applied in chunks; each is a transaction of its own and safe to retry.
const CHUNK = 150;

export async function seed(): Promise<number> {
  const entry = seedBundle().entry ?? [];
  for (let start = 0; start < entry.length; start += CHUNK) {
    await fhir.transaction({ resourceType: "Bundle", type: "transaction", entry: entry.slice(start, start + CHUNK) });
  }
  return entry.length;
}
