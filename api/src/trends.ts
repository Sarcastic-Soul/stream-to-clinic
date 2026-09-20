// Catchment view: what the citizen reports add up to over weeks, per site and per region.
// One report tells a clinic what to watch for today; the trend tells a health authority which
// stream is drifting and where to look first.
import { listAlerts, type AlertSummary } from "./alerts.js";
import { fhir } from "./fhir.js";
import type { ObservationSummary } from "./mapping.js";
import { CITIZEN_INDICATORS, OAH_CODE_SYSTEM, OAH_PROFILES, type CitizenIndicator } from "./oah.js";
import { RISK_LEVELS, highestLevel, type RiskLevel } from "./rules.js";
import { loadSites, siteObservations, type Site } from "./store.js";

export const TREND_DAYS = { default: 28, min: 7, max: 90 } as const;

/** Which way a value moved between the first and the second half of the window. */
export type Direction = "rising" | "falling" | "steady";

export interface TrendPoint {
  /** Day the value belongs to, as YYYY-MM-DD. */
  date: string;
  /** Mean of that day's readings for a quantity; count of present/abundant reports for a presence indicator. */
  value: number;
}

export interface IndicatorTrend {
  indicator: CitizenIndicator;
  display: string;
  kind: "quantity" | "presence";
  unitLabel?: string;
  reports: number;
  points: TrendPoint[];
  /** Mean over the older half of the window, and over the newer half. */
  earlier?: number;
  recent?: number;
  change?: number;
  direction: Direction;
}

export interface HealthBaseline {
  code: string;
  display: string;
  value: number;
  unit: string;
  period: string;
}

export interface SiteTrend {
  siteId: string;
  name: string;
  waterBody: string;
  region: string;
  reports: number;
  reporters: number;
  riskLevel: RiskLevel;
  activeAlerts: { id: string; title: string; level: RiskLevel; answered: boolean }[];
  indicators: IndicatorTrend[];
  /** District health measures seeded from the OAH IG, for context next to the stream trend. */
  health: HealthBaseline[];
}

export interface RegionTrend {
  region: string;
  sites: number;
  reports: number;
  sitesAtRisk: number;
  activeAlerts: number;
  answeredAlerts: number;
}

export interface Trends {
  from: string;
  to: string;
  days: number;
  totals: {
    sites: number;
    reports: number;
    reporters: number;
    activeAlerts: number;
    answeredAlerts: number;
  };
  regions: RegionTrend[];
  sites: SiteTrend[];
}

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

// How much a reading has to move before it counts as a trend rather than noise: the smaller of a
// tenth of the earlier mean and a change that matters in the water itself. The relative part keeps
// the rule sensible across scales (8 mg/L of oxygen, 3000 µS/cm of conductivity); the absolute part
// stops a real 1 °C rise being called steady just because the numbers are large.
const NOTICEABLE: Partial<Record<CitizenIndicator, number>> = {
  waterTemperature: 0.8, // °C
  pH: 0.15,
  dissolvedO2: 0.4, // mg/L
  conductivity: 60, // µS/cm
};

function directionOf(indicator: CitizenIndicator, earlier: number, recent: number, decimals: number): Direction {
  const step = 10 ** -decimals;
  const threshold = Math.max(Math.min(Math.abs(earlier) * 0.1, NOTICEABLE[indicator] ?? Infinity), step);
  if (recent - earlier > threshold) return "rising";
  if (earlier - recent > threshold) return "falling";
  return "steady";
}

const decimalsFor = (indicator: CitizenIndicator) =>
  indicator === "conductivity" ? 0 : indicator === "pH" ? 2 : 1;

// Exported for tests: the whole trend is built from this one function.
export function trendFor(indicator: CitizenIndicator, observations: ObservationSummary[]): IndicatorTrend | undefined {
  const entry = CITIZEN_INDICATORS[indicator];
  const mine = observations.filter((o) => o.indicator === indicator);
  if (mine.length === 0) return undefined;
  const decimals = decimalsFor(indicator);

  const byDay = new Map<string, number[]>();
  for (const o of mine) {
    const value = entry.kind === "quantity" ? Number(o.value) : o.value === "present" || o.value === "abundant" ? 1 : 0;
    if (!Number.isFinite(value)) continue;
    byDay.set(dayOf(o.observedAt), [...(byDay.get(dayOf(o.observedAt)) ?? []), value]);
  }
  const points = [...byDay.entries()]
    .map(([date, values]) => ({
      date,
      value: entry.kind === "quantity" ? round(mean(values), decimals) : values.reduce((sum, v) => sum + v, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const base: IndicatorTrend = {
    indicator,
    display: entry.display,
    kind: entry.kind,
    ...("unitLabel" in entry ? { unitLabel: entry.unitLabel } : {}),
    reports: mine.length,
    points,
    direction: "steady",
  };
  if (entry.kind !== "quantity") return base;

  // Compare the two halves of the reported period rather than its endpoints, so one odd reading
  // cannot turn a flat stream into a "rising" one. The split follows the readings themselves, not
  // the requested window: a site whose volunteers started last week still gets a direction.
  const times = mine.map((o) => Date.parse(o.observedAt)).filter(Number.isFinite);
  const midpoint = (Math.min(...times) + Math.max(...times)) / 2;
  const half = (older: boolean) =>
    mine.filter((o) => (Date.parse(o.observedAt) < midpoint) === older).map((o) => Number(o.value)).filter(Number.isFinite);
  const earlierValues = half(true);
  const recentValues = half(false);
  if (earlierValues.length === 0 || recentValues.length === 0) return base;

  const earlier = round(mean(earlierValues), decimals);
  const recent = round(mean(recentValues), decimals);
  return { ...base, earlier, recent, change: round(recent - earlier, decimals), direction: directionOf(indicator, earlier, recent, decimals) };
}

// District health measures (ObservationHealthMeasureOah) seeded per site, newest period first.
async function loadHealthBaselines(): Promise<Map<string, HealthBaseline[]>> {
  const { matches } = await fhir.search("Observation", { _profile: OAH_PROFILES.observationHealthMeasure, _count: 200 });
  const bySite = new Map<string, HealthBaseline[]>();
  for (const observation of matches) {
    const siteId = observation.subject?.reference?.replace("Location/", "");
    const coding = observation.code?.coding?.find((c) => c.system === OAH_CODE_SYSTEM);
    const quantity = observation.valueQuantity;
    if (!siteId || !coding?.code || quantity?.value === undefined) continue;
    bySite.set(siteId, [
      ...(bySite.get(siteId) ?? []),
      {
        code: coding.code,
        display: coding.display ?? coding.code,
        value: quantity.value,
        unit: quantity.unit ?? "",
        period: observation.effectivePeriod?.start?.slice(0, 4) ?? "",
      },
    ]);
  }
  return bySite;
}

const INDICATOR_ORDER = Object.keys(CITIZEN_INDICATORS) as CitizenIndicator[];

function siteTrend(
  site: Site,
  observations: ObservationSummary[],
  alerts: AlertSummary[],
  health: HealthBaseline[],
): SiteTrend {
  const mine = alerts.filter((a) => a.siteId === site.id);
  return {
    siteId: site.id,
    name: site.name,
    waterBody: site.waterBody,
    region: site.region,
    reports: observations.length,
    reporters: new Set(observations.map((o) => o.reporter)).size,
    riskLevel: highestLevel(mine.map((a) => a.level)),
    activeAlerts: mine.map((a) => ({ id: a.id, title: a.title, level: a.level, answered: a.acknowledgements.length > 0 })),
    indicators: INDICATOR_ORDER.flatMap((indicator) => trendFor(indicator, observations) ?? []),
    health,
  };
}

export function regionTrends(sites: SiteTrend[]): RegionTrend[] {
  const byRegion = new Map<string, SiteTrend[]>();
  for (const site of sites) byRegion.set(site.region, [...(byRegion.get(site.region) ?? []), site]);
  return [...byRegion.entries()]
    .map(([region, members]) => ({
      region,
      sites: members.length,
      reports: members.reduce((sum, s) => sum + s.reports, 0),
      sitesAtRisk: members.filter((s) => s.riskLevel !== "none").length,
      activeAlerts: members.reduce((sum, s) => sum + s.activeAlerts.length, 0),
      answeredAlerts: members.reduce((sum, s) => sum + s.activeAlerts.filter((a) => a.answered).length, 0),
    }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

export function clampDays(value: unknown): number {
  const days = Math.trunc(Number(value));
  if (!Number.isFinite(days) || days <= 0) return TREND_DAYS.default;
  return Math.min(Math.max(days, TREND_DAYS.min), TREND_DAYS.max);
}

export async function loadTrends(days: number = TREND_DAYS.default, now = new Date()): Promise<Trends> {
  const to = now.getTime();
  const from = to - days * DAY_MS;
  const since = new Date(from).toISOString();

  const [sites, alerts, health] = await Promise.all([loadSites(), listAlerts(), loadHealthBaselines()]);
  const observations = await Promise.all(sites.map((site) => siteObservations(site.id, 500, since)));
  const reporters = new Set(observations.flat().map((o) => o.reporter));
  const ordered = sites
    .map((site, index) => siteTrend(site, observations[index], alerts, health.get(site.id) ?? []))
    .sort(
      (a, b) =>
        RISK_LEVELS.indexOf(b.riskLevel) - RISK_LEVELS.indexOf(a.riskLevel) ||
        b.reports - a.reports ||
        a.name.localeCompare(b.name),
    );

  return {
    from: since,
    to: now.toISOString(),
    days,
    totals: {
      sites: ordered.length,
      reports: ordered.reduce((sum, s) => sum + s.reports, 0),
      reporters: reporters.size,
      activeAlerts: alerts.length,
      answeredAlerts: alerts.filter((a) => a.acknowledgements.length > 0).length,
    },
    regions: regionTrends(ordered),
    sites: ordered,
  };
}
