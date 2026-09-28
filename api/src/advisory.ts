// Plain-language advisory for a clinic, drafted by a language model from an alert the rule engine
// already decided. The model never decides anything: it is given the risk, its level, the reasons
// and the narrative, and asked to rewrite them for the person at the clinic desk. If no model is
// configured the feature stays dormant and the rest of the API is unaffected.
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import { DAILY_LIMIT_MESSAGE, converse, isBusy, isTimeout, llmDailyLimit, llmEnabled, replyText, type Converse } from "./llm.js";
import type { AlertSummary } from "./alerts.js";
import { STC_PROFILES } from "./oah.js";

const ADVISORY_CATEGORY = { system: "http://terminology.hl7.org/CodeSystem/communication-category", code: "instruction" };
const PARTICIPANT_TYPE = "http://terminology.hl7.org/CodeSystem/provenance-participant-type";
const DATA_OPERATION = "http://terminology.hl7.org/CodeSystem/v3-DataOperation";
const DISCLAIMER = "Demo heuristic, not clinical guidance.";

/** The model is a FHIR Device, so its output can be attributed like any other participant. */
export const ADVISOR_DEVICE_ID = "stc-ai-advisor";

export interface Advisory {
  id: string;
  text: string;
  model: string;
  generatedAt: string;
  fhirUrl: string;
}

export const advisoryEnabled = llmEnabled;

export function advisorDevice(model: string): fhir4.Device {
  return {
    resourceType: "Device",
    id: ADVISOR_DEVICE_ID,
    meta: { profile: [STC_PROFILES.advisorDevice] },
    status: "active",
    deviceName: [{ name: `Stream-to-Clinic advisory model (${model})`, type: "model-name" }],
    type: { text: "Language model used to rewrite a rule-engine alert in plain language" },
    note: [{ text: "Drafts advisory text only. Risk levels and alerts come from the deterministic rule engine." }],
  };
}

const publicUrl = (reference: string) => `${config.publicFhirUrl}/${reference}`;

export function toAdvisory(comm: fhir4.Communication): Advisory | undefined {
  const text = comm.payload?.[0]?.contentString;
  const model = comm.sender?.display ?? "";
  if (!comm.id || !text || comm.sender?.reference !== `Device/${ADVISOR_DEVICE_ID}`) return undefined;
  return {
    id: comm.id,
    text,
    model,
    generatedAt: comm.sent ?? comm.meta?.lastUpdated ?? "",
    fhirUrl: publicUrl(`Communication/${comm.id}`),
  };
}

export function toAdvisoryCommunication(alert: AlertSummary, text: string, model: string, sent: string): fhir4.Communication {
  return {
    resourceType: "Communication",
    meta: { profile: [STC_PROFILES.clinicAdvisory] },
    status: "completed",
    category: [{ coding: [ADVISORY_CATEGORY] }],
    subject: { reference: `Group/cohort-${alert.siteId}` },
    about: [{ reference: `DetectedIssue/${alert.id}` }],
    sender: { reference: `Device/${ADVISOR_DEVICE_ID}`, display: model },
    sent,
    payload: [{ contentString: text }],
  };
}

// Lineage for machine-written text: the Device is the author, the DetectedIssue the source it was
// derived from. A reader can see at a glance that a human did not write this paragraph.
export function toAdvisoryProvenance(communicationId: string, alert: AlertSummary, model: string, recorded: string): fhir4.Provenance {
  return {
    resourceType: "Provenance",
    meta: { profile: [STC_PROFILES.advisoryProvenance] },
    target: [{ reference: `Communication/${communicationId}` }],
    recorded,
    activity: { coding: [{ system: DATA_OPERATION, code: "CREATE", display: "create" }] },
    agent: [
      {
        type: { coding: [{ system: PARTICIPANT_TYPE, code: "author", display: "Author" }] },
        who: { reference: `Device/${ADVISOR_DEVICE_ID}`, display: model },
      },
      {
        type: { coding: [{ system: PARTICIPANT_TYPE, code: "assembler", display: "Assembler" }] },
        who: { display: "Stream-to-Clinic risk engine" },
      },
    ],
    entity: [{ role: "source", what: { reference: `DetectedIssue/${alert.id}` } }],
  };
}

export function buildPrompt(alert: AlertSummary): string {
  return [
    "You write short notices for staff at a small primary-care clinic in Europe.",
    "A rule engine has raised the alert below from citizen reports about a nearby stream and local weather.",
    "",
    `Alert: ${alert.title}`,
    `Level: ${alert.level}`,
    `Stream site: ${alert.siteName}`,
    `Watch for: ${alert.watchFor || "environmental risk only; no clinical guidance was issued"}`,
    "Reasons the engine gave:",
    ...alert.reasons.map((reason) => `- ${reason}`),
    "How the engine decided:",
    ...alert.narrative.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Write the notice with these rules:",
    "- Use only the facts above. Invent no measurements, no case numbers, no dates and no place names.",
    "- Do not change or restate the risk level in your own terms, and do not say the risk is higher or lower than it is.",
    "- Give no diagnosis, no treatment and no medication advice.",
    "- Three short paragraphs, at most 110 words in total, plain language, no headings, no bullet points, no markdown:",
    "  what has been seen at the stream; what to ask patients who come in; what staff can tell people who ask.",
    "- British English. Address the clinic as 'you'.",
  ].join("\n");
}

/** Calls the models in turn until one answers. Throws on a failed or empty response; callers decide what to do about it. */
export async function draftAdvisory(alert: AlertSummary, send: Converse = converse): Promise<{ text: string; model: string }> {
  const models = config.bedrockModels;
  if (!models.length) throw new Error("No advisory model configured");

  // Busy spells are short: after one pass through the list, pause and try once more.
  const attempts = [...models, ...models];
  const deadline = Date.now() + 45_000;
  let lastError: Error | undefined;
  for (const [i, modelId] of attempts.entries()) {
    if (i === models.length) await new Promise((resolve) => setTimeout(resolve, 1500));
    const remaining = deadline - Date.now();
    if (remaining <= 1000) break;
    let text: string;
    try {
      const response = await send(
        {
          modelId,
          messages: [{ role: "user", content: [{ text: buildPrompt(alert) }] }],
          inferenceConfig: { temperature: 0.2, maxTokens: 400 },
        },
        AbortSignal.timeout(Math.min(remaining, 15_000)),
      );
      text = replyText(response);
    } catch (err) {
      // A model that hangs or is throttled is tried again later, or the next one is.
      if (isTimeout(err)) lastError = new Error("The advisory model took too long");
      else if (isBusy(err)) lastError = new Error(`Model request failed (${(err as Error).name})`);
      else throw new Error(`Model request failed (${err instanceof Error ? err.name : "unknown error"})`);
      continue;
    }
    if (!text) throw new Error("Model returned no text");
    return { text: `${text}\n\n${DISCLAIMER}`, model: modelId };
  }
  throw lastError ?? new Error("The advisory model could not be reached");
}

export async function loadAdvisory(alertId: string): Promise<Advisory | undefined> {
  const matches = await fhir.searchAll("Communication", {
    category: `${ADVISORY_CATEGORY.system}|${ADVISORY_CATEGORY.code}`,
    _sort: "-_lastUpdated",
    _count: 200,
  });
  return matches
    .filter((comm) => comm.about?.[0]?.reference === `DetectedIssue/${alertId}`)
    .flatMap((comm) => toAdvisory(comm) ?? [])[0];
}

export type AdvisoryResult = Advisory | { error: string; status: 404 | 429 | 503 | 502 };

// One advisory per alert: an existing one is returned as it is, so the text a clinic already read
// cannot change under it, and a demo cannot run up a bill.
export async function adviseOnAlert(alert: AlertSummary | undefined): Promise<AdvisoryResult> {
  if (!alert) return { error: "Unknown alert", status: 404 };
  const existing = await loadAdvisory(alert.id);
  if (existing) return existing;
  if (!advisoryEnabled()) return { error: "The advisory model is not configured on this server", status: 503 };
  if (!llmDailyLimit.take()) return { error: DAILY_LIMIT_MESSAGE, status: 429 };

  let draft: { text: string; model: string };
  try {
    draft = await draftAdvisory(alert);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The advisory model could not be reached", status: 502 };
  }

  const now = new Date().toISOString();
  const created = await fhir.create(toAdvisoryCommunication(alert, draft.text, draft.model, now));
  if (!created.id) return { error: "The advisory could not be stored", status: 502 };
  await fhir.create(toAdvisoryProvenance(created.id, alert, draft.model, now));
  return toAdvisory(created) ?? { error: "The advisory could not be stored", status: 502 };
}
