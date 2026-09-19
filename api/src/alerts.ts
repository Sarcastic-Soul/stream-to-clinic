// Turns risk decisions into FHIR alerts: one active DetectedIssue per site and risk (deduplicated by
// identifier), plus a Communication to each clinic serving the site when the issue is first raised.
import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { buildNarrative, narrativeText, parseNarrative } from "./narrative.js";
import { ALERT_ID_SYSTEM, RISK_SYSTEM } from "./oah.js";
import { RISKS, evaluateRisks, type RiskDecision, type RiskId, type RiskLevel } from "./rules.js";
import { loadClinics, siteObservations, type ClinicSummary, type Site } from "./store.js";
import { getWeather } from "./weather.js";

export interface AlertSummary {
  id: string;
  risk: RiskId;
  title: string;
  level: RiskLevel;
  siteId: string;
  siteName: string;
  createdAt: string;
  reasons: string[];
  narrative: string[];
  watchFor: string;
  evidence: string[];
  fhir: { detectedIssue: string; communications: string[] };
}

const ENGINE = { display: "Stream-to-Clinic risk engine" };
const DISCLAIMER = "Demo heuristic, not clinical guidance.";
const ALERT_CATEGORY = { system: "http://terminology.hl7.org/CodeSystem/communication-category", code: "alert" };

const SEVERITY: Record<Exclude<RiskLevel, "none">, fhir4.DetectedIssue["severity"]> = {
  low: "low",
  medium: "moderate",
  high: "high",
};

const alertKey = (siteId: string, risk: RiskId) => `${siteId}:${risk}`;
const publicUrl = (reference: string) => `${config.publicFhirUrl}/${reference}`;
const isActive = (issue: fhir4.DetectedIssue) => !issue.identifiedPeriod?.end;

export function toDetectedIssue(
  site: Site,
  decision: RiskDecision,
  start: string,
  narrative: string[] = [],
): fhir4.DetectedIssue {
  const { title, watchFor } = RISKS[decision.risk];
  const met = decision.conditions.filter((c) => c.met);
  return {
    resourceType: "DetectedIssue",
    identifier: [{ system: ALERT_ID_SYSTEM, value: alertKey(site.id, decision.risk) }],
    status: "final",
    code: { coding: [{ system: RISK_SYSTEM, code: decision.risk, display: title }], text: title },
    severity: SEVERITY[decision.level as Exclude<RiskLevel, "none">] ?? "low",
    identifiedPeriod: { start },
    author: ENGINE,
    implicated: [{ reference: `Location/${site.id}`, display: site.name }],
    // One evidence entry per satisfied condition: the plain-language reason plus supporting Observations.
    evidence: met.map((c) => ({
      code: [{ text: c.text }],
      ...(c.evidence.length ? { detail: c.evidence.map((id) => ({ reference: `Observation/${id}` })) } : {}),
    })),
    // Summary line, then the numbered narrative steps (parsed back by parseNarrative).
    detail: [`${title} at ${site.name}. ${met.map((c) => c.text).join(" ")} ${DISCLAIMER}`, ...(narrative.length ? ["", narrativeText(narrative)] : [])].join("\n"),
    ...(watchFor ? { mitigation: [{ action: { text: watchFor } }] } : {}),
  };
}

export function toCommunication(site: Site, decision: RiskDecision, issueRef: string, clinic: { id: string; name: string }) {
  const { title, watchFor } = RISKS[decision.risk];
  const reasons = decision.conditions.filter((c) => c.met).map((c) => c.text);
  return {
    resourceType: "Communication",
    status: "completed",
    category: [{ coding: [ALERT_CATEGORY] }],
    priority: decision.level === "high" ? "urgent" : "routine",
    subject: { reference: `Group/cohort-${site.id}` },
    about: [{ reference: issueRef }],
    recipient: [{ reference: `Organization/${clinic.id}`, display: clinic.name }],
    sender: ENGINE,
    sent: new Date().toISOString(),
    payload: [
      {
        contentString: `${title} at ${site.name} (${site.waterBody}). Watch for: ${watchFor} Why: ${reasons.join(" ")} ${DISCLAIMER}`,
      },
    ],
  } satisfies fhir4.Communication;
}

// Maps Communication recipients back to the DetectedIssue each one is about.
async function loadCommunications() {
  const { matches } = await fhir.search("Communication", {
    category: `${ALERT_CATEGORY.system}|${ALERT_CATEGORY.code}`,
    _sort: "-_lastUpdated",
    _count: 200,
  });
  const byIssue = new Map<string, { id: string; clinicId: string }[]>();
  for (const comm of matches) {
    const issueId = comm.about?.[0]?.reference?.replace("DetectedIssue/", "");
    const clinicId = comm.recipient?.[0]?.reference?.replace("Organization/", "") ?? "";
    if (!issueId || !comm.id) continue;
    byIssue.set(issueId, [...(byIssue.get(issueId) ?? []), { id: comm.id, clinicId }]);
  }
  return byIssue;
}

type Communications = Awaited<ReturnType<typeof loadCommunications>>;

export function toAlertSummary(issue: fhir4.DetectedIssue, comms: Communications): AlertSummary | undefined {
  const risk = issue.code?.coding?.find((c) => c.system === RISK_SYSTEM)?.code as RiskId | undefined;
  const site = issue.implicated?.[0];
  if (!issue.id || !risk || !(risk in RISKS) || !site?.reference) return undefined;
  const reasons = (issue.evidence ?? []).flatMap((e) => e.code?.[0]?.text ?? []);
  const level = (Object.keys(SEVERITY) as Exclude<RiskLevel, "none">[]).find((l) => SEVERITY[l] === issue.severity);
  return {
    id: issue.id,
    risk,
    title: issue.code?.text ?? RISKS[risk].title,
    level: level ?? "low",
    siteId: site.reference.replace("Location/", ""),
    siteName: site.display ?? "",
    createdAt: issue.identifiedPeriod?.start ?? issue.meta?.lastUpdated ?? "",
    reasons,
    // Issues raised before narratives were recorded fall back to their reasons.
    narrative: parseNarrative(issue.detail).length ? parseNarrative(issue.detail) : reasons,
    watchFor: issue.mitigation?.[0]?.action.text ?? "",
    evidence: (issue.evidence ?? []).flatMap((e) =>
      (e.detail ?? []).flatMap((d) => d.reference?.replace("Observation/", "") ?? []),
    ),
    fhir: {
      detectedIssue: publicUrl(`DetectedIssue/${issue.id}`),
      communications: (comms.get(issue.id) ?? []).map((c) => publicUrl(`Communication/${c.id}`)),
    },
  };
}

// Active alerts, newest first, optionally limited to one site or to alerts sent to one clinic.
export async function listAlerts(filter: { siteId?: string; clinicId?: string } = {}): Promise<AlertSummary[]> {
  const [{ matches }, comms] = await Promise.all([
    fhir.search("DetectedIssue", {
      code: `${RISK_SYSTEM}|`,
      _sort: "-_lastUpdated",
      _count: 200,
      ...(filter.siteId ? { implicated: `Location/${filter.siteId}` } : {}),
    }),
    loadCommunications(),
  ]);
  return matches
    .filter(isActive)
    .filter((i) => !filter.clinicId || (comms.get(i.id ?? "") ?? []).some((c) => c.clinicId === filter.clinicId))
    .flatMap((i) => toAlertSummary(i, comms) ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAlert(id: string): Promise<AlertSummary | undefined> {
  const [issue, comms] = await Promise.all([fhir.read("DetectedIssue", id), loadCommunications()]);
  return issue ? toAlertSummary(issue, comms) : undefined;
}

// One evaluation per site at a time, so concurrent reports cannot raise duplicate issues.
const queues = new Map<string, Promise<unknown>>();
function serialise<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
  queues.set(key, next);
  return next;
}

// Re-runs every rule for a site. Raises or refreshes alerts whose rule fires, closes active alerts
// whose rule no longer fires, and returns the alerts raised or updated.
export function evaluateSite(site: Site, log: FastifyBaseLogger): Promise<AlertSummary[]> {
  return serialise(site.id, () => evaluate(site, log));
}

// Queues an evaluation unless one for the site is already waiting to start; bursts of Subscription
// notifications (e.g. a bulk load of Observations) then cost one evaluation, not one each.
const waiting = new Set<string>();
export function scheduleEvaluation(site: Site, log: FastifyBaseLogger): void {
  if (waiting.has(site.id)) return;
  waiting.add(site.id);
  serialise(site.id, () => {
    waiting.delete(site.id);
    return evaluate(site, log);
  }).catch((err) => log.error(err, "risk evaluation failed"));
}

async function evaluate(site: Site, log: FastifyBaseLogger): Promise<AlertSummary[]> {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString();
  const [observations, weather, existing, allClinics] = await Promise.all([
    siteObservations(site.id, 200, since),
    getWeather(site.lat, site.lon),
    fhir.search("DetectedIssue", { implicated: `Location/${site.id}`, code: `${RISK_SYSTEM}|`, _count: 100 }),
    loadClinics(),
  ]);
  const clinics = allClinics.filter((c) => c.siteIds.includes(site.id));
  const narrate = (decision: RiskDecision) =>
    buildNarrative({
      decision,
      siteName: site.name,
      reportCount: observations.length,
      weather,
      clinics: RISKS[decision.risk].watchFor ? clinics.map((c) => c.name) : [],
    });

  const raised: string[] = [];
  for (const decision of evaluateRisks(observations, weather, now)) {
    log.info({ siteId: site.id, ...decision }, "risk decision");
    const active = existing.matches.find(
      (i) => isActive(i) && i.identifier?.some((id) => id.value === alertKey(site.id, decision.risk)),
    );

    if (decision.fired && active?.id) {
      const start = active.identifiedPeriod?.start ?? now.toISOString();
      await fhir.update({ ...toDetectedIssue(site, decision, start, narrate(decision)), id: active.id });
      raised.push(active.id);
    } else if (decision.fired) {
      const notify = RISKS[decision.risk].watchFor ? clinics : [];
      raised.push(await raise(site, decision, now.toISOString(), narrate(decision), notify));
    } else if (active?.id) {
      await fhir.update({ ...active, id: active.id, identifiedPeriod: { ...active.identifiedPeriod, end: now.toISOString() } });
    }
  }

  if (!raised.length) return [];
  return (await listAlerts({ siteId: site.id })).filter((a) => raised.includes(a.id));
}

// Creates the DetectedIssue and its clinic Communications atomically in one transaction.
async function raise(
  site: Site,
  decision: RiskDecision,
  start: string,
  narrative: string[],
  clinics: ClinicSummary[],
): Promise<string> {
  const issueUrl = `urn:uuid:${randomUUID()}`;
  const bundle: fhir4.Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      { fullUrl: issueUrl, resource: toDetectedIssue(site, decision, start, narrative), request: { method: "POST", url: "DetectedIssue" } },
      ...clinics.map((clinic) => ({
        resource: toCommunication(site, decision, issueUrl, clinic),
        request: { method: "POST" as const, url: "Communication" },
      })),
    ],
  };
  const response = await fhir.transaction(bundle);
  const location = response.entry?.[0]?.response?.location ?? "";
  return location.split("/")[1] ?? "";
}
