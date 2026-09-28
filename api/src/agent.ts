// Question answering over the Stream-to-Clinic FHIR data. A language model (Gemini, function
// calling) decides which read-only tools to call, and answers only from what they return. Every
// tool call is kept and sent back with the answer, including the public FHIR query behind it, so
// the answer can be checked against the data rather than trusted.
import { config } from "./config.js";
import { TOOLS, TOOL_NAMES, ToolInputError, inputJsonSchema, runTool, type ToolResult } from "./agent-tools.js";

export const MAX_ROUNDS = 6;
const MAX_CALLS_PER_ROUND = 4;
const TOTAL_TIMEOUT_MS = 55_000;
// One model call; a model that hangs longer than this is treated as busy.
const MODEL_CALL_TIMEOUT_MS = 20_000;
const TOOL_RESULT_CHARS = 14_000;

export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  fhirUrls: string[];
  error?: boolean;
}

export interface AgentAnswer {
  question: string;
  answer: string;
  steps: AgentStep[];
  model: string;
  answeredAt: string;
}

export class AgentError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503 | 504,
    /** The model was busy or too slow: another model may still answer. */
    readonly busy = false,
  ) {
    super(message);
  }
}

export const agentEnabled = () => Boolean(config.geminiApiKey);

export function systemPrompt(today: string): string {
  return [
    "You answer questions about Stream-to-Clinic, a public-health early-warning system built on the OneAquaHealth (OAH) FHIR Implementation Guide.",
    "Citizen scientists report readings at urban stream sites in Crete (Greece) and Benevento (Italy): water temperature, pH, dissolved oxygen, conductivity, foam/colour/smell, filamentous algae and mosquito larvae (Diptera).",
    "A deterministic rule engine combines those reports with rainfall and raises alerts (FHIR DetectedIssue) for algal bloom, sewage overflow, mosquito breeding and low oxygen, and notifies the clinics serving the site (FHIR Communication). Clinics can reply.",
    `Today is ${today}.`,
    "",
    "Rules:",
    "- Use the tools to look the data up. Answer only from what the tools return; never invent sites, readings, dates, counts or clinics.",
    "- If the data does not answer the question, say so plainly and say what the data does cover.",
    "- Only answer questions about this system's data. Politely decline anything else.",
    "- Give no diagnosis, no treatment and no medical advice. You may repeat what the rule engine says clinics should watch for.",
    "- Do not change or second-guess the risk levels the rule engine set.",
    "- Answer in the language of the question, in plain words, at most 120 words. Name sites and clinics by name, give the key numbers with units and dates.",
    "- No headings and no tables. Short '- ' bullet lines are fine. No markdown other than that.",
    "- All data is synthetic demo data; mention it only if asked.",
  ].join("\n");
}

export function functionDeclarations() {
  return TOOL_NAMES.map((name) => ({
    name,
    description: TOOLS[name].description,
    parametersJsonSchema: inputJsonSchema(name),
  }));
}

interface Part {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> };
  [key: string]: unknown;
}
interface Content {
  role: "user" | "model";
  parts: Part[];
}
interface GeminiResponse {
  candidates?: { content?: Content; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export interface AgentDeps {
  fetch?: typeof fetch;
  runTool?: (name: string, args: unknown) => Promise<ToolResult>;
  now?: () => Date;
  /** Pause before the second pass through the models. */
  retryPauseMs?: number;
}

function clip(data: unknown): unknown {
  const text = JSON.stringify(data);
  if (text.length <= TOOL_RESULT_CHARS) return data;
  return { truncated: true, json: `${text.slice(0, TOOL_RESULT_CHARS)}…` };
}

const answerText = (content: Content | undefined) =>
  (content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

export async function askAgent(question: string, deps: AgentDeps = {}): Promise<AgentAnswer> {
  const { geminiApiKey, geminiModels } = config;
  if (!geminiApiKey || !geminiModels.length) throw new AgentError("The agent model is not configured on this server", 503);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  // A busy model hands the whole question to the next one: thought signatures belong to the model
  // that wrote them, so a conversation cannot switch models halfway.
  // Busy spells are short, so after one pass through the list it tries once more.
  let busy: AgentError | undefined;
  for (let pass = 0; pass < 2; pass++) {
    if (pass) await new Promise((resolve) => setTimeout(resolve, deps.retryPauseMs ?? 1500));
    for (const model of geminiModels) {
      if (Date.now() >= deadline) throw new AgentError("The agent took too long to answer", 504);
      try {
        return await askModel(model, question, deadline, deps);
      } catch (err) {
        if (!(err instanceof AgentError) || !err.busy) throw err;
        busy = err;
      }
    }
  }
  throw busy!;
}

async function askModel(geminiModel: string, question: string, deadline: number, deps: AgentDeps): Promise<AgentAnswer> {
  const { geminiApiKey } = config;
  const doFetch = deps.fetch ?? fetch;
  const run = deps.runTool ?? runTool;
  const now = deps.now ?? (() => new Date());

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  const steps: AgentStep[] = [];

  async function generate(allowTools: boolean): Promise<Content | undefined> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AgentError("The agent took too long to answer", 504);
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(now().toISOString().slice(0, 10)) }] },
          contents,
          tools: [{ functionDeclarations: functionDeclarations() }],
          toolConfig: { functionCallingConfig: { mode: allowTools ? "AUTO" : "NONE" } },
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(Math.min(remaining, MODEL_CALL_TIMEOUT_MS)),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") throw new AgentError("The agent took too long to answer", 504, true);
      throw new AgentError("The agent model could not be reached", 502);
    }
    if (response.status === 429 || response.status === 503)
      throw new AgentError("The agent model is busy (free-tier limit). Try again in a minute.", 502, true);
    if (!response.ok) throw new AgentError(`Model request failed (${response.status})`, 502);
    const body = (await response.json()) as GeminiResponse;
    if (body.promptFeedback?.blockReason) throw new AgentError(`The model declined the question (${body.promptFeedback.blockReason})`, 502);
    return body.candidates?.[0]?.content;
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const content = await generate(true);
    const calls = (content?.parts ?? []).filter((p) => p.functionCall);
    if (!content || !calls.length) {
      const answer = answerText(content);
      if (!answer) throw new AgentError("The model returned no answer", 502);
      return { question, answer, steps, model: geminiModel, answeredAt: now().toISOString() };
    }

    // Echo the model's turn back unchanged: it carries the thought signatures later turns need.
    contents.push({ role: "model", parts: content.parts });
    const responses: Part[] = [];
    for (const part of calls.slice(0, MAX_CALLS_PER_ROUND)) {
      const { name, args = {}, id } = part.functionCall!;
      let response: Record<string, unknown>;
      try {
        const result = await run(name, args);
        steps.push({ tool: name, args, summary: result.summary, fhirUrls: result.fhirUrls });
        response = { result: clip(result.data) };
      } catch (err) {
        const message = err instanceof ToolInputError ? err.message : "The tool failed to read the FHIR server";
        steps.push({ tool: name, args, summary: message, fhirUrls: [], error: true });
        response = { error: message };
      }
      responses.push({ functionResponse: { name, ...(id ? { id } : {}), response } });
    }
    // Calls beyond the per-round cap still need an answer, or the model waits for them.
    for (const part of calls.slice(MAX_CALLS_PER_ROUND)) {
      const { name, id } = part.functionCall!;
      responses.push({ functionResponse: { name, ...(id ? { id } : {}), response: { error: "Too many tool calls at once; ask again if needed." } } });
    }
    contents.push({ role: "user", parts: responses });
  }

  // Out of rounds: ask for the best answer from what has been gathered, with no more tool calls.
  const final = answerText(await generate(false));
  if (!final) throw new AgentError("The model returned no answer", 502);
  return { question, answer: final, steps, model: geminiModel, answeredAt: now().toISOString() };
}

/**
 * Keeps a free-tier model key usable in public: a few questions per minute per client, a daily cap
 * overall, and recent answers served again for the same question without calling the model.
 */
export class AgentGuard {
  private readonly perClient = new Map<string, number[]>();
  private day = "";
  private dayCount = 0;
  private readonly cache = new Map<string, { answer: AgentAnswer; at: number }>();

  constructor(
    readonly perMinute = 5,
    readonly perDay = 300,
    readonly cacheMs = 10 * 60_000,
  ) {}

  static key(question: string) {
    return question.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
  }

  cached(question: string, now = Date.now()): AgentAnswer | undefined {
    const hit = this.cache.get(AgentGuard.key(question));
    return hit && now - hit.at < this.cacheMs ? hit.answer : undefined;
  }

  remember(answer: AgentAnswer, now = Date.now()) {
    if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(AgentGuard.key(answer.question), { answer, at: now });
  }

  /** Returns a reason to refuse, or undefined and counts the request. */
  admit(client: string, now = Date.now()): string | undefined {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.perDay) return "The agent has answered its daily quota of questions. Try again tomorrow.";
    const recent = (this.perClient.get(client) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.perMinute) return `Too many questions: at most ${this.perMinute} a minute. Try again shortly.`;
    recent.push(now);
    this.perClient.set(client, recent);
    this.dayCount++;
    if (this.perClient.size > 5_000) this.perClient.clear();
    return undefined;
  }
}
