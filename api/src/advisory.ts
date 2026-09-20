// Plain-language advisory for a clinic, drafted by a language model from an alert the rule engine
// already decided. The model never decides anything: it is given the risk, its level, the reasons
// and the narrative, and asked to rewrite them for the person at the clinic desk. If no key is
// configured the feature stays dormant and the rest of the API is unaffected.
import { config } from "./config.js";
import { fhir } from "./fhir.js";
import type { AlertSummary } from "./alerts.js";

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

export const advisoryEnabled = () => Boolean(config.geminiApiKey);

export function advisorDevice(model: string): fhir4.Device {
  return {
    resourceType: "Device",
    id: ADVISOR_DEVICE_ID,
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

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Calls the model. Throws on a failed or empty response; callers decide what to do about it. */
export async function draftAdvisory(alert: AlertSummary): Promise<string> {
  const { geminiApiKey, geminiModel } = config;
  if (!geminiApiKey) throw new Error("No model key configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(alert) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);

  const body = (await response.json()) as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error(body.promptFeedback?.blockReason ?? "Model returned no text");
  return `${text}\n\n${DISCLAIMER}`;
}

export async function loadAdvisory(alertId: string): Promise<Advisory | undefined> {
  const { matches } = await fhir.search("Communication", {
    category: `${ADVISORY_CATEGORY.system}|${ADVISORY_CATEGORY.code}`,
    _sort: "-_lastUpdated",
    _count: 200,
  });
  return matches
    .filter((comm) => comm.about?.[0]?.reference === `DetectedIssue/${alertId}`)
    .flatMap((comm) => toAdvisory(comm) ?? [])[0];
}

export type AdvisoryResult = Advisory | { error: string; status: 404 | 503 | 502 };

// One advisory per alert: an existing one is returned as it is, so the text a clinic already read
// cannot change under it, and a demo cannot run up a bill.
export async function adviseOnAlert(alert: AlertSummary | undefined): Promise<AdvisoryResult> {
  if (!alert) return { error: "Unknown alert", status: 404 };
  const existing = await loadAdvisory(alert.id);
  if (existing) return existing;
  if (!advisoryEnabled()) return { error: "The advisory model is not configured on this server", status: 503 };

  let text: string;
  try {
    text = await draftAdvisory(alert);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The advisory model could not be reached", status: 502 };
  }

  const now = new Date().toISOString();
  const created = await fhir.create(toAdvisoryCommunication(alert, text, config.geminiModel, now));
  if (!created.id) return { error: "The advisory could not be stored", status: 502 };
  await fhir.create(toAdvisoryProvenance(created.id, alert, config.geminiModel, now));
  return toAdvisory(created) ?? { error: "The advisory could not be stored", status: 502 };
}
