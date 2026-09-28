// Read-only tools over the Stream-to-Clinic FHIR data, shared by the question-answering agent
// (POST /agent/ask) and the MCP server (/mcp). Every tool reports the public FHIR queries behind
// its answer, so a reader can open the same data the model saw instead of taking its word for it.
import { z } from "zod";
import { listAlerts } from "./alerts.js";
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { CITIZEN_INDICATORS, OAH_PROFILES, RISK_SYSTEM, isCitizenIndicator } from "./oah.js";
import { highestLevel } from "./rules.js";
import { latestPerIndicator, loadClinics, loadSites, siteObservations } from "./store.js";
import { TREND_DAYS, clampDays, loadTrends } from "./trends.js";

export interface ToolResult {
  /** One line for people, shown next to the queries in the app. */
  summary: string;
  /** What the model (or MCP client) gets back. */
  data: unknown;
  /** Public FHIR URLs of the queries the tool ran. */
  fhirUrls: string[];
}

export class ToolInputError extends Error {}

/** Resource types the generic search may touch: the ones this app writes, nothing else. */
export const SEARCHABLE = {
  Location: ["name", "address", "partof", "_profile"],
  Observation: ["subject", "code", "date", "_profile", "focus"],
  DetectedIssue: ["implicated", "code", "identified"],
  Communication: ["category", "recipient", "sender", "sent", "subject"],
  Organization: ["name", "address-city"],
  HealthcareService: ["organization", "coverage-area"],
  Group: ["code", "characteristic"],
  Provenance: ["target", "recorded", "agent"],
} as const satisfies Record<string, readonly string[]>;

type Searchable = keyof typeof SEARCHABLE;
const COMMON_PARAMS = ["_id", "_lastUpdated", "_sort", "_count"];
const MAX_COUNT = 20;
const SAFE_VALUE = /^[\w\-.:|/,@ %+]{1,200}$/;

export const publicQuery = (type: string, params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return `${config.publicFhirUrl}/${type}${query ? `?${query}` : ""}`;
};

/** Checks a model- or client-supplied search against the allow-list. Throws ToolInputError. */
export function guardSearch(resourceType: string, params: Record<string, string> = {}): { type: Searchable; params: Record<string, string> } {
  if (!Object.hasOwn(SEARCHABLE, resourceType)) {
    throw new ToolInputError(`Resource type ${resourceType} is not searchable here. Use one of: ${Object.keys(SEARCHABLE).join(", ")}.`);
  }
  const type = resourceType as Searchable;
  const allowed = new Set<string>([...SEARCHABLE[type], ...COMMON_PARAMS]);
  const clean: Record<string, string> = {};
  for (const [name, raw] of Object.entries(params)) {
    const value = String(raw);
    if (!allowed.has(name)) throw new ToolInputError(`Search parameter ${name} is not allowed for ${type}. Allowed: ${[...allowed].join(", ")}.`);
    if (!SAFE_VALUE.test(value)) throw new ToolInputError(`Search value for ${name} is not allowed.`);
    clean[name] = value;
  }
  const count = Number(clean._count ?? 10);
  clean._count = String(Number.isFinite(count) ? Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT) : 10);
  return { type, params: clean };
}

// Dropped from the resource itself only: nested `text` (CodeableConcept, Annotation) carries meaning.
const TOP_LEVEL_TRIM = new Set(["meta", "text", "contained"]);
const TRIM_ANYWHERE = new Set(["extension", "modifierExtension"]);

/** A resource with the bulky parts dropped and long strings cut, so a page of results fits in a prompt. */
export function compactResource(resource: fhir4.Resource): Record<string, unknown> {
  const trim = (value: unknown, depth: number): unknown => {
    if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
    if (Array.isArray(value)) return value.slice(0, 8).map((v) => trim(v, depth + 1));
    if (value && typeof value === "object") {
      if (depth > 5) return "…";
      return Object.fromEntries(
        Object.entries(value)
          .filter(([k]) => !TRIM_ANYWHERE.has(k) && !(depth === 0 && TOP_LEVEL_TRIM.has(k)))
          .map(([k, v]) => [k, trim(v, depth + 1)]),
      );
    }
    return value;
  };
  return { ...(trim(resource, 0) as Record<string, unknown>), url: `${config.publicFhirUrl}/${resource.resourceType}/${resource.id}` };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const indicatorIds = Object.keys(CITIZEN_INDICATORS) as [string, ...string[]];

/**
 * The tool catalogue. Input schemas are zod shapes: the MCP server registers them as they are,
 * and the agent turns them into JSON Schema for the model.
 */
export const TOOLS = {
  list_sites: {
    description:
      "List the stream monitoring sites (OAH LocationOah) with their water body, region, coordinates, current risk level and the latest citizen reading for each indicator.",
    input: {},
    async run(): Promise<ToolResult> {
      const [sites, alerts] = await Promise.all([loadSites(), listAlerts()]);
      const data = await Promise.all(
        sites.map(async (site) => ({
          ...site,
          riskLevel: highestLevel(alerts.filter((a) => a.siteId === site.id).map((a) => a.level)),
          latest: latestPerIndicator(await siteObservations(site.id)).map(({ indicator, value, unit, observedAt }) => ({
            indicator,
            value,
            unit,
            observedAt,
          })),
        })),
      );
      return {
        summary: `Read ${plural(data.length, "stream site")} and their latest readings`,
        data,
        fhirUrls: [publicQuery("Location", { _profile: OAH_PROFILES.location })],
      };
    },
  },

  list_clinics: {
    description: "List the clinics (FHIR Organization) and the stream sites each one serves (HealthcareService coverage area).",
    input: {},
    async run(): Promise<ToolResult> {
      const clinics = await loadClinics();
      return {
        summary: `Read ${plural(clinics.length, "clinic")} and the sites they serve`,
        data: clinics,
        fhirUrls: [publicQuery("HealthcareService", { _include: "HealthcareService:organization" })],
      };
    },
  },

  list_alerts: {
    description:
      "List the active water-health alerts (FHIR DetectedIssue raised by the rule engine), newest first, with risk, level, site, the engine's reasons, what clinics should watch for, and which notified clinics have replied. Optionally filter by siteId or clinicId.",
    input: {
      siteId: z.string().max(64).optional().describe("Only alerts for this site, e.g. Loc-Almyros"),
      clinicId: z.string().max(64).optional().describe("Only alerts sent to this clinic (Organization id)"),
    },
    async run(args: { siteId?: string; clinicId?: string }): Promise<ToolResult> {
      const alerts = await listAlerts({ siteId: args.siteId, clinicId: args.clinicId });
      const data = alerts.slice(0, 20).map((a) => ({
        id: a.id,
        title: a.title,
        level: a.level,
        siteId: a.siteId,
        siteName: a.siteName,
        raisedAt: a.createdAt,
        reasons: a.reasons,
        watchFor: a.watchFor,
        clinicsNotified: a.fhir.communications.length,
        replies: a.acknowledgements.map((r) => ({ clinic: r.clinicName, action: r.actionLabel, at: r.at })),
        url: a.fhir.detectedIssue,
      }));
      return {
        summary: `Found ${plural(alerts.length, "active alert")}${args.siteId ? ` at ${args.siteId}` : ""}${args.clinicId ? ` for ${args.clinicId}` : ""}`,
        data,
        fhirUrls: [
          publicQuery("DetectedIssue", { code: `${RISK_SYSTEM}|`, ...(args.siteId ? { implicated: `Location/${args.siteId}` } : {}) }),
          ...(args.clinicId ? [publicQuery("Communication", { recipient: `Organization/${args.clinicId}` })] : []),
        ],
      };
    },
  },

  get_trends: {
    description:
      "Catchment trends over several weeks: per site and indicator, the mean in the older and newer half of the window and whether it is rising, falling or steady; district health baselines; and per region how many sites are at risk and how many alerts clinics answered.",
    input: {
      days: z.number().int().min(TREND_DAYS.min).max(TREND_DAYS.max).optional().describe(`Window in days, default ${TREND_DAYS.default}`),
    },
    async run(args: { days?: number }): Promise<ToolResult> {
      const days = clampDays(args.days ?? TREND_DAYS.default);
      const trends = await loadTrends(days);
      const data = {
        from: trends.from,
        to: trends.to,
        totals: trends.totals,
        regions: trends.regions,
        sites: trends.sites.map((s) => ({
          siteId: s.siteId,
          name: s.name,
          region: s.region,
          reports: s.reports,
          riskLevel: s.riskLevel,
          indicators: s.indicators.map(({ indicator, unitLabel, reports, earlier, recent, change, direction }) => ({
            indicator,
            unitLabel,
            reports,
            earlier,
            recent,
            change,
            direction,
          })),
          health: s.health,
        })),
      };
      return {
        summary: `Read ${days} days of trends: ${plural(trends.totals.reports, "report")} across ${plural(trends.totals.sites, "site")}`,
        data,
        fhirUrls: [
          publicQuery("Observation", { _profile: OAH_PROFILES.observationIndicators, date: `ge${trends.from.slice(0, 10)}` }),
          publicQuery("Observation", { _profile: OAH_PROFILES.observationHealthMeasure }),
        ],
      };
    },
  },

  site_observations: {
    description:
      "Recent citizen readings at one site, newest first (FHIR Observation, OAH ObservationIndicatorsOah). Optionally only one indicator and only the last N days.",
    input: {
      siteId: z.string().max(64).describe("Site id, e.g. Loc-Almyros"),
      indicator: z.enum(indicatorIds).optional().describe("Only this indicator"),
      days: z.number().int().min(1).max(90).optional().describe("Only the last N days, default 14"),
    },
    async run(args: { siteId: string; indicator?: string; days?: number }): Promise<ToolResult> {
      if (!/^[A-Za-z0-9\-.]{1,64}$/.test(args.siteId)) throw new ToolInputError(`Unknown site ${args.siteId}`);
      if (args.indicator && !isCitizenIndicator(args.indicator)) throw new ToolInputError(`Unknown indicator ${args.indicator}`);
      const days = Math.min(Math.max(Math.trunc(args.days ?? 14), 1), 90);
      const since = new Date(Date.now() - days * 24 * 3_600_000).toISOString();
      const all = await siteObservations(args.siteId, 200, since);
      const readings = all.filter((o) => !args.indicator || o.indicator === args.indicator);
      return {
        summary: `Read ${plural(readings.length, "reading")} at ${args.siteId} over ${days} days`,
        data: readings.slice(0, 60).map(({ id, indicator, value, unit, observedAt, reporter }) => ({ id, indicator, value, unit, observedAt, reporter })),
        fhirUrls: [
          publicQuery("Observation", {
            subject: `Location/${args.siteId}`,
            _profile: OAH_PROFILES.observationIndicators,
            date: `ge${since.slice(0, 10)}`,
            _sort: "-date",
          }),
        ],
      };
    },
  },

  search_fhir: {
    description:
      "Run a read-only FHIR R4 search on the Stream-to-Clinic server when the other tools do not cover the question. Allowed resource types and parameters: " +
      Object.entries(SEARCHABLE)
        .map(([type, params]) => `${type} (${params.join(", ")})`)
        .join("; ") +
      `. _id, _lastUpdated, _sort and _count (max ${MAX_COUNT}) work everywhere. Returns trimmed resources with their URLs.`,
    input: {
      resourceType: z.enum(Object.keys(SEARCHABLE) as [Searchable, ...Searchable[]]).describe("FHIR resource type"),
      params: z.record(z.string(), z.string()).optional().describe('Search parameters, e.g. {"implicated": "Location/Loc-Almyros"}'),
    },
    async run(args: { resourceType: string; params?: Record<string, string> }): Promise<ToolResult> {
      const { type, params } = guardSearch(args.resourceType, args.params);
      const { matches } = await fhir.search(type, params);
      return {
        summary: `Searched ${type}: ${matches.length} ${matches.length === 1 ? "match" : "matches"}`,
        data: matches.map((r) => compactResource(r)),
        fhirUrls: [publicQuery(type, params)],
      };
    },
  },
} as const;

export type ToolName = keyof typeof TOOLS;
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

/** Validates arguments against the tool's schema and runs it. Throws ToolInputError on bad input. */
export async function runTool(name: string, args: unknown): Promise<ToolResult> {
  if (!Object.hasOwn(TOOLS, name)) throw new ToolInputError(`Unknown tool ${name}`);
  const tool = TOOLS[name as ToolName];
  const parsed = z.object(tool.input).strict().safeParse(args ?? {});
  if (!parsed.success) throw new ToolInputError(`Bad arguments for ${name}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  return (tool.run as (a: unknown) => Promise<ToolResult>)(parsed.data);
}

/** JSON Schema for a tool's input, for the model's function declarations. */
export function inputJsonSchema(name: ToolName): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(z.object(TOOLS[name].input)) as Record<string, unknown>;
  return schema;
}
