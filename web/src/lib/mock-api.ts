// In-browser stand-in for the API, used only when NEXT_PUBLIC_API_MOCK=1.
// Sites follow the OneAquaHealth IG examples; readings, clinics and weather are synthetic.

import { ApiError, FHIR_URL } from "./api";
import type {
  AlertSummary,
  Api,
  ClinicSummary,
  Indicator,
  ObservationSummary,
  Presence,
  RiskLevel,
  SiteDetail,
  SiteSummary,
} from "./types";

const INDICATORS: Indicator[] = [
  { id: "waterTemperature", display: "Water temperature", kind: "quantity", unit: "Cel", unitLabel: "°C", min: 0, max: 40 },
  { id: "pH", display: "pH", kind: "quantity", unit: "[pH]", unitLabel: "pH", min: 0, max: 14 },
  { id: "dissolvedO2", display: "Dissolved O2", kind: "quantity", unit: "mg/L", unitLabel: "mg/L", min: 0, max: 20 },
  { id: "conductivity", display: "Conductivity", kind: "quantity", unit: "uS/cm", unitLabel: "µS/cm", min: 0, max: 20000 },
  { id: "foam", display: "Foam/colour/smell", kind: "presence" },
  { id: "filamentousAlgae", display: "Filamentous algae", kind: "presence" },
  { id: "diptera", display: "Diptera", kind: "presence" },
];

type Site = Omit<SiteSummary, "riskLevel" | "latest">;

// Same ids, names and coordinates as the seeded API.
const SITES: Site[] = [
  { id: "Loc-Almyros", name: "Almyros monitoring reach", waterBody: "Almyros Stream", region: "Crete, Greece", lat: 35.33399, lon: 25.04834 },
  { id: "Loc-Giofyros", name: "Giofyros monitoring reach", waterBody: "Giofyros River", region: "Crete, Greece", lat: 35.32135, lon: 25.10592 },
  {
    id: "Loc-Giofyros-LowerReach",
    name: "Giofyros monitoring reach (lower)",
    waterBody: "Giofyros River",
    region: "Crete, Greece",
    lat: 35.2623,
    lon: 25.10458,
  },
  { id: "Loc-Benevento", name: "Benevento", waterBody: "Calore River", region: "Campania, Italy", lat: 41.13, lon: 14.78 },
];

const CLINICS: ClinicSummary[] = [
  { id: "clinic-almyros", name: "Almyros Primary Care Unit (demo)", city: "Gazi", siteIds: ["Loc-Almyros"] },
  { id: "clinic-benevento", name: "Benevento Riverside Community Clinic (demo)", city: "Benevento", siteIds: ["Loc-Benevento"] },
  { id: "clinic-giofyros-valley", name: "Giofyros Valley Health Post (demo)", city: "Heraklion", siteIds: ["Loc-Giofyros-LowerReach"] },
  {
    id: "clinic-heraklion-west",
    name: "Heraklion West Family Health Clinic (demo)",
    city: "Heraklion",
    siteIds: ["Loc-Almyros", "Loc-Giofyros", "Loc-Giofyros-LowerReach"],
  },
];

// Synthetic weather standing in for Open-Meteo: a dry week at Almyros, recent rain on the Giofyros, a storm over Benevento.
const WEATHER: Record<string, { rain24h: number; rain7d: number }> = {
  "Loc-Almyros": { rain24h: 0, rain7d: 0.4 },
  "Loc-Giofyros": { rain24h: 0, rain7d: 10.3 },
  "Loc-Giofyros-LowerReach": { rain24h: 0, rain7d: 10.3 },
  "Loc-Benevento": { rain24h: 26, rain7d: 38 },
};

// Per site: [water °C, pH, O₂ mg/L, conductivity µS/cm] today, and the daily drift over the last week.
const BASELINES: Record<string, { today: number[]; drift: number[] }> = {
  "Loc-Almyros": { today: [26.8, 8.1, 6.1, 2951], drift: [0.35, 0.02, -0.15, 6] },
  "Loc-Giofyros": { today: [21.4, 7.9, 8.2, 640], drift: [0.1, 0, 0, 3] },
  "Loc-Giofyros-LowerReach": { today: [22.4, 7.5, 3.7, 1070], drift: [0.2, -0.02, -0.15, -3] },
  "Loc-Benevento": { today: [17.6, 7.4, 6.9, 760], drift: [-0.15, -0.03, -0.1, 20] },
};

const PRESENCE: { siteId: string; indicator: string; value: Presence; hoursAgo: number; reporter: string }[] = [
  { siteId: "Loc-Almyros", indicator: "filamentousAlgae", value: "present", hoursAgo: 70, reporter: "Eleni K." },
  { siteId: "Loc-Almyros", indicator: "filamentousAlgae", value: "abundant", hoursAgo: 5, reporter: "Nikos P." },
  { siteId: "Loc-Giofyros", indicator: "foam", value: "absent", hoursAgo: 30, reporter: "Maria S." },
  { siteId: "Loc-Giofyros-LowerReach", indicator: "diptera", value: "present", hoursAgo: 20, reporter: "Maria S." },
  { siteId: "Loc-Benevento", indicator: "foam", value: "abundant", hoursAgo: 9, reporter: "Giulia R." },
];

const QUANTITIES = ["waterTemperature", "pH", "dissolvedO2", "conductivity"];
const REPORTERS = ["Eleni K.", "Nikos P.", "Giulia R.", "Marco T.", "Maria S."];
const HOUR = 3_600_000;
const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
const round = (n: number, digits: number) => Number(n.toFixed(digits));

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${nextId++}`;

const newestFirst = (a: { observedAt?: string; createdAt?: string }, b: typeof a) =>
  (b.observedAt ?? b.createdAt ?? "").localeCompare(a.observedAt ?? a.createdAt ?? "");

// Newest first per site.
const observationsBySite = new Map<string, ObservationSummary[]>();

SITES.forEach((site, s) => {
  const { today, drift } = BASELINES[site.id];
  const list: ObservationSummary[] = [];
  for (let day = 7; day >= 0; day--) {
    QUANTITIES.forEach((indicator, q) => {
      const wobble = day === 0 ? 0 : Math.sin((day + 1) * (q + 2) + s) * (q === 3 ? 15 : 0.2);
      list.push({
        id: newId("obs"),
        indicator,
        value: round(today[q] - drift[q] * day + wobble, q === 3 ? 0 : 1),
        unit: INDICATORS.find((i) => i.id === indicator)?.unit,
        observedAt: iso(day * 24 + 6 + s),
        reporter: REPORTERS[(day + s) % REPORTERS.length],
      });
    });
  }
  for (const p of PRESENCE.filter((p) => p.siteId === site.id)) {
    list.push({ id: newId("obs"), indicator: p.indicator, value: p.value, observedAt: iso(p.hoursAgo), reporter: p.reporter });
  }
  observationsBySite.set(site.id, list.sort(newestFirst));
});

let alerts: AlertSummary[] = [];

const LEVEL_ORDER: RiskLevel[] = ["none", "low", "medium", "high"];
const maxLevel = (levels: RiskLevel[]) =>
  levels.reduce<RiskLevel>((max, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(max) ? l : max), "none");

function latestPerIndicator(siteId: string): Map<string, ObservationSummary> {
  const latest = new Map<string, ObservationSummary>();
  for (const o of observationsBySite.get(siteId) ?? []) if (!latest.has(o.indicator)) latest.set(o.indicator, o);
  return latest;
}

type Finding = Pick<AlertSummary, "risk" | "title" | "level" | "reasons" | "watchFor" | "evidence">;

// Same rules as docs/PLAN.md section 7, evaluated on the latest reading per indicator.
function evaluate(site: Site): Finding[] {
  const latest = latestPerIndicator(site.id);
  const weather = WEATHER[site.id];
  const temp = latest.get("waterTemperature");
  const tempValue = typeof temp?.value === "number" ? temp.value : undefined;
  const seen = (indicator: string) => {
    const o = latest.get(indicator);
    return o && (o.value === "present" || o.value === "abundant") ? o : undefined;
  };
  const findings: Finding[] = [];

  const algae = seen("filamentousAlgae");
  if (algae && temp && tempValue !== undefined && tempValue >= 25 && weather.rain7d <= 5) {
    findings.push({
      risk: "algal-bloom",
      title: "Possible algal bloom",
      level: algae.value === "abundant" ? "high" : "medium",
      reasons: [
        `Filamentous algae reported as ${algae.value}.`,
        `Water temperature is ${tempValue} °C (threshold 25 °C).`,
        `Only ${weather.rain7d} mm of rain in the last 7 days (threshold 5 mm), so the water is still.`,
      ],
      watchFor: "Skin rashes and gastrointestinal symptoms (nausea, vomiting, diarrhoea) after contact with stream water.",
      evidence: [algae.id, temp.id],
    });
  }

  const foam = seen("foam");
  if (foam && weather.rain24h >= 20 && now - Date.parse(foam.observedAt) <= 48 * HOUR) {
    findings.push({
      risk: "sewage-overflow",
      title: "Possible sewage overflow",
      level: "medium",
      reasons: [
        `${weather.rain24h} mm of rain in the last 24 hours (threshold 20 mm).`,
        `Foam reported as ${foam.value} within the last 48 hours.`,
      ],
      watchFor: "Gastrointestinal infections, especially in children and people who use the stream for recreation.",
      evidence: [foam.id],
    });
  }

  const diptera = seen("diptera");
  if (diptera && temp && tempValue !== undefined && tempValue >= 20 && weather.rain7d > 0) {
    findings.push({
      risk: "mosquito-breeding",
      title: "Mosquito breeding conditions",
      level: "medium",
      reasons: [
        `Diptera (mosquito larvae) reported as ${diptera.value}.`,
        `Water temperature is ${tempValue} °C (threshold 20 °C).`,
        `${weather.rain7d} mm of rain in the last 7 days left standing water.`,
      ],
      watchFor: "Fever with rash or joint pain; consider vector-borne infections such as West Nile virus.",
      evidence: [diptera.id, temp.id],
    });
  }

  const oxygen = latest.get("dissolvedO2");
  if (oxygen && typeof oxygen.value === "number" && oxygen.value < 4) {
    findings.push({
      risk: "low-oxygen",
      title: "Low dissolved oxygen",
      level: oxygen.value < 2 ? "medium" : "low",
      reasons: [`Dissolved oxygen is ${oxygen.value} mg/L (threshold 4 mg/L); fish and invertebrates are under stress.`],
      watchFor: "",
      evidence: [oxygen.id],
    });
  }
  return findings;
}

// Returns alerts raised or updated for the site.
function reevaluate(site: Site, at: string): AlertSummary[] {
  const changed: AlertSummary[] = [];
  for (const finding of evaluate(site)) {
    const existing = alerts.find((a) => a.siteId === site.id && a.risk === finding.risk);
    const id = existing?.id ?? newId("alert");
    const alert: AlertSummary = {
      ...finding,
      id,
      siteId: site.id,
      siteName: site.name,
      createdAt: existing?.createdAt ?? at,
      fhir: {
        detectedIssue: `${FHIR_URL}/DetectedIssue/${id}`,
        communications:
          finding.watchFor === ""
            ? []
            : CLINICS.filter((c) => c.siteIds.includes(site.id)).map((c) => `${FHIR_URL}/Communication/${id}-${c.id}`),
      },
    };
    if (existing && JSON.stringify(existing) === JSON.stringify(alert)) continue;
    alerts = [alert, ...alerts.filter((a) => a.id !== id)];
    changed.push(alert);
  }
  return changed;
}

for (const site of SITES) {
  const latest = latestPerIndicator(site.id);
  for (const finding of evaluate(site)) {
    const at = finding.evidence.map((id) => [...latest.values()].find((o) => o.id === id)!.observedAt).sort().at(-1)!;
    reevaluate(site, at);
  }
}
alerts.sort(newestFirst);

function summary(site: Site): SiteSummary {
  return {
    ...site,
    riskLevel: maxLevel(alerts.filter((a) => a.siteId === site.id).map((a) => a.level)),
    latest: [...latestPerIndicator(site.id).values()],
  };
}

function findSite(id: string): Site {
  const site = SITES.find((s) => s.id === id);
  if (!site) throw new ApiError(`Unknown site: ${id}`, 404);
  return site;
}

const delay = <T>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

const run = <T>(fn: () => T, ms?: number): Promise<T> => {
  try {
    return delay(fn(), ms);
  } catch (error) {
    return new Promise((_, reject) => setTimeout(() => reject(error), ms ?? 250));
  }
};

export const mockApi: Api = {
  getHealth: () => delay({ status: "ok" as const, fhir: "4.0.1" }),
  getIndicators: () => delay(INDICATORS),
  getSites: () => run(() => SITES.map(summary)),
  getSite: (id) =>
    run((): SiteDetail => {
      const site = findSite(id);
      return {
        ...summary(site),
        observations: (observationsBySite.get(id) ?? []).slice(0, 50),
        alerts: alerts.filter((a) => a.siteId === id),
        clinics: CLINICS.filter((c) => c.siteIds.includes(id)),
      };
    }),
  createReport: (input) =>
    run(() => {
      const site = findSite(input.siteId);
      const indicator = INDICATORS.find((i) => i.id === input.indicator);
      if (!indicator) throw new ApiError(`Unknown indicator: ${input.indicator}`, 404);
      const reporter = input.reporter.trim();
      if (reporter.length < 1 || reporter.length > 120) throw new ApiError("Reporter name must be 1–120 characters.", 400);
      if ((input.note?.length ?? 0) > 1000) throw new ApiError("Note must be at most 1000 characters.", 400);
      const valid =
        indicator.kind === "quantity"
          ? typeof input.value === "number" && input.value >= (indicator.min ?? -Infinity) && input.value <= (indicator.max ?? Infinity)
          : input.value === "absent" || input.value === "present" || input.value === "abundant";
      if (!valid) throw new ApiError(`Invalid value for ${indicator.display}.`, 400);

      const observation: ObservationSummary = {
        id: newId("obs"),
        indicator: indicator.id,
        value: input.value,
        unit: indicator.unit,
        observedAt: input.observedAt ?? new Date().toISOString(),
        reporter,
      };
      observationsBySite.get(site.id)!.unshift(observation);
      return {
        observation,
        fhirUrl: `${FHIR_URL}/Observation/${observation.id}`,
        alerts: reevaluate(site, new Date().toISOString()),
      };
    }, 400),
  getClinics: () => delay(CLINICS),
  getAlerts: (filter = {}) =>
    run(() => {
      const clinic = filter.clinicId ? CLINICS.find((c) => c.id === filter.clinicId) : undefined;
      if (filter.clinicId && !clinic) throw new ApiError(`Unknown clinic: ${filter.clinicId}`, 404);
      // Clinics only receive alerts that were communicated to them (not environmental-only ones).
      return alerts
        .filter((a) => (!clinic || (clinic.siteIds.includes(a.siteId) && a.watchFor !== "")) && (!filter.siteId || a.siteId === filter.siteId))
        .sort(newestFirst);
    }),
  getAlert: (id) =>
    run(() => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) throw new ApiError(`Unknown alert: ${id}`, 404);
      return alert;
    }),
};
