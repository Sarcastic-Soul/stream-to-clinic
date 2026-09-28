// Question answering over the Stream-to-Clinic FHIR data. A language model on Amazon Bedrock (tool
// use through the Converse API) decides which read-only tools to call, and answers only from what
// they return. Every tool call is kept and sent back with the answer, including the public FHIR
// query behind it, so the answer can be checked against the data rather than trusted.
import type { ContentBlock, Message, Tool } from "@aws-sdk/client-bedrock-runtime";
import { config } from "./config.js";
import { TOOLS, TOOL_NAMES, ToolInputError, inputJsonSchema, runTool, type ToolResult } from "./agent-tools.js";
import { converse as bedrockConverse, isBusy, isTimeout, llmEnabled, replyText, type Converse } from "./llm.js";

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

export const agentEnabled = llmEnabled;

export function systemPrompt(today: string): string {
  return [
    "You answer questions about Stream-to-Clinic, a public-health early-warning system built on the OneAquaHealth (OAH) FHIR Implementation Guide.",
    "Citizen scientists report readings at urban stream sites in Crete (Greece) and Benevento (Italy): water temperature, pH, dissolved oxygen, conductivity, foam/colour/smell, filamentous algae and mosquito larvae (Diptera).",
    "A deterministic rule engine combines those reports with rainfall and raises alerts (FHIR DetectedIssue) for algal bloom, sewage overflow, mosquito breeding and low oxygen, and notifies the clinics serving the site (FHIR Communication). Clinics can reply.",
    `Today is ${today}.`,
    "",
    "Rules:",
    "- Use the tools to look the data up. Answer only from what the tools return; never invent sites, readings, dates, counts, thresholds or clinics.",
    "- For any question about alerts, risks or whether something is wrong, call list_alerts: the rule engine's alerts are the only source of truth for risk. For changes over time, call get_trends.",
    "- If the data does not answer the question, say so plainly and say what the data does cover.",
    "- Only answer questions about this system's data. Politely decline anything else.",
    "- Give no diagnosis, no treatment and no medical advice. You may repeat what the rule engine says clinics should watch for.",
    "- Do not change or second-guess the risk levels the rule engine set.",
    "- Answer in the language of the question, in plain words, at most 120 words. Name sites and clinics by name, give the key numbers with units and dates.",
    "- No headings and no tables. Short '- ' bullet lines are fine. No markdown other than that.",
    "- All data is synthetic demo data; mention it only if asked.",
  ].join("\n");
}

export function toolSpecs(): Tool[] {
  return TOOL_NAMES.map((name) => ({
    toolSpec: {
      name,
      description: TOOLS[name].description,
      // The SDK types the schema as a DocumentType; ours is plain JSON Schema.
      inputSchema: { json: inputJsonSchema(name) as never },
    },
  }));
}

export interface AgentDeps {
  converse?: Converse;
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

export async function askAgent(question: string, deps: AgentDeps = {}): Promise<AgentAnswer> {
  const models = config.bedrockModels;
  if (!models.length) throw new AgentError("The agent model is not configured on this server", 503);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  // A busy model hands the whole question to the next one, so one conversation stays with one model.
  // Busy spells are short, so after one pass through the list it tries once more.
  let busy: AgentError | undefined;
  for (let pass = 0; pass < 2; pass++) {
    if (pass) await new Promise((resolve) => setTimeout(resolve, deps.retryPauseMs ?? 1500));
    for (const model of models) {
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

async function askModel(modelId: string, question: string, deadline: number, deps: AgentDeps): Promise<AgentAnswer> {
  const send = deps.converse ?? bedrockConverse;
  const run = deps.runTool ?? runTool;
  const now = deps.now ?? (() => new Date());
  const messages: Message[] = [{ role: "user", content: [{ text: question }] }];
  const steps: AgentStep[] = [];
  const system = [{ text: systemPrompt(now().toISOString().slice(0, 10)) }];
  const toolConfig = { tools: toolSpecs() };

  async function generate() {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AgentError("The agent took too long to answer", 504);
    try {
      return await send(
        { modelId, system, messages, toolConfig, inferenceConfig: { maxTokens: 2048, temperature: 0 } },
        AbortSignal.timeout(Math.min(remaining, MODEL_CALL_TIMEOUT_MS)),
      );
    } catch (err) {
      if (isTimeout(err)) throw new AgentError("The agent took too long to answer", 504, true);
      if (isBusy(err)) throw new AgentError("The agent model is busy. Try again in a minute.", 502, true);
      throw new AgentError(`Model request failed (${err instanceof Error ? err.name : "unknown error"})`, 502);
    }
  }

  const done = (answer: string): AgentAnswer => ({ question, answer, steps, model: modelId, answeredAt: now().toISOString() });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await generate();
    const message = response.output?.message;
    const calls = (message?.content ?? []).filter((block) => block.toolUse);
    if (!message || response.stopReason !== "tool_use" || !calls.length) {
      const answer = replyText(response);
      if (!answer) throw new AgentError("The model returned no answer", 502);
      return done(answer);
    }

    messages.push(message);
    const results: ContentBlock[] = [];
    for (const block of calls.slice(0, MAX_CALLS_PER_ROUND)) {
      const { name = "", toolUseId, input } = block.toolUse!;
      const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
      try {
        const result = await run(name, args);
        steps.push({ tool: name, args, summary: result.summary, fhirUrls: result.fhirUrls });
        results.push({ toolResult: { toolUseId, content: [{ text: JSON.stringify(clip(result.data)) }] } });
      } catch (err) {
        const text = err instanceof ToolInputError ? err.message : "The tool failed to read the FHIR server";
        steps.push({ tool: name, args, summary: text, fhirUrls: [], error: true });
        results.push({ toolResult: { toolUseId, content: [{ text }], status: "error" } });
      }
    }
    // Calls beyond the per-round cap still need a result, or the conversation is invalid.
    for (const block of calls.slice(MAX_CALLS_PER_ROUND)) {
      results.push({
        toolResult: { toolUseId: block.toolUse!.toolUseId, content: [{ text: "Too many tool calls at once; ask again if needed." }], status: "error" },
      });
    }
    // On the last round, ask for the answer from what has been gathered.
    if (round === MAX_ROUNDS - 1) results.push({ text: "Answer now from the tool results above. Do not call any more tools." });
    messages.push({ role: "user", content: results });
  }

  const final = replyText(await generate());
  if (!final) throw new AgentError("The model returned no answer", 502);
  return done(final);
}

/**
 * Keeps the model bill small in public: a few questions per minute per client, and recent answers
 * served again for the same question without calling the model. The daily cap is shared with the
 * advisory ({@link llmDailyLimit}).
 */
export class AgentGuard {
  private readonly perClient = new Map<string, number[]>();
  private readonly cache = new Map<string, { answer: AgentAnswer; at: number }>();

  constructor(
    readonly perMinute = 5,
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
    const recent = (this.perClient.get(client) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.perMinute) return `Too many questions: at most ${this.perMinute} a minute. Try again shortly.`;
    recent.push(now);
    this.perClient.set(client, recent);
    if (this.perClient.size > 5_000) this.perClient.clear();
    return undefined;
  }
}
