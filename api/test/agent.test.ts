import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentError, AgentGuard, MAX_ROUNDS, askAgent, functionDeclarations, systemPrompt } from "../src/agent.js";
import { ToolInputError, compactResource, guardSearch, inputJsonSchema, runTool, type ToolResult } from "../src/agent-tools.js";
import { config } from "../src/config.js";

config.geminiApiKey = "test-key";
config.geminiModels = ["gemini-test"];

type Body = { contents: { role: string; parts: Record<string, unknown>[] }[]; toolConfig: { functionCallingConfig: { mode: string } } };

// A scripted model: each call returns the next reply and records what it was sent.
function scriptedModel(replies: unknown[]) {
  const sent: Body[] = [];
  const fetchStub = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    const reply = replies.shift();
    if (reply instanceof Response) return reply;
    return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fetchStub, sent };
}

const call = (name: string, args: Record<string, unknown> = {}, id?: string) => ({
  candidates: [{ content: { role: "model", parts: [{ functionCall: { name, args, ...(id ? { id } : {}) }, thoughtSignature: "sig" }] } }],
});
const text = (value: string) => ({ candidates: [{ content: { role: "model", parts: [{ text: value }] } }] });

const alertsResult: ToolResult = {
  summary: "Found 1 active alert",
  data: [{ id: "1225", title: "Possible algal bloom", level: "medium" }],
  fhirUrls: ["https://example.org/fhir/DetectedIssue?code=x%7C"],
};

test("the agent calls a tool, feeds the result back and answers with the steps it took", async () => {
  const model = scriptedModel([call("list_alerts", { siteId: "Loc-Almyros" }, "call-1"), text("One alert: a possible algal bloom at Almyros.")]);
  const calls: [string, unknown][] = [];
  const result = await askAgent("Any alerts at Almyros?", {
    fetch: model.fetch,
    runTool: async (name, args) => {
      calls.push([name, args]);
      return alertsResult;
    },
    now: () => new Date("2026-09-28T10:00:00Z"),
  });

  assert.equal(result.answer, "One alert: a possible algal bloom at Almyros.");
  assert.equal(result.model, "gemini-test");
  assert.deepEqual(calls, [["list_alerts", { siteId: "Loc-Almyros" }]]);
  assert.deepEqual(result.steps, [
    { tool: "list_alerts", args: { siteId: "Loc-Almyros" }, summary: alertsResult.summary, fhirUrls: alertsResult.fhirUrls },
  ]);

  // Second request: the model's own turn echoed back (with its thought signature), then the tool result.
  const second = model.sent[1].contents;
  assert.equal(second[1].role, "model");
  assert.equal(second[1].parts[0].thoughtSignature, "sig");
  assert.deepEqual(second[2].parts[0], {
    functionResponse: { name: "list_alerts", id: "call-1", response: { result: alertsResult.data } },
  });
});

test("a refused tool call is shown as a failed step and reported to the model", async () => {
  const model = scriptedModel([call("search_fhir", { resourceType: "Patient" }), text("I can only read stream data.")]);
  const result = await askAgent("List patients", {
    fetch: model.fetch,
    runTool: async () => {
      throw new ToolInputError("Resource type Patient is not searchable here.");
    },
  });
  assert.equal(result.steps[0].error, true);
  assert.match(result.steps[0].summary, /Patient is not searchable/);
  const response = model.sent[1].contents[2].parts[0].functionResponse as { response: { error: string } };
  assert.match(response.response.error, /not searchable/);
});

test("after the last tool round the model must answer without tools", async () => {
  const replies = [...Array.from({ length: MAX_ROUNDS }, () => call("list_sites")), text("Here is what I found.")];
  const model = scriptedModel(replies);
  const result = await askAgent("Tell me everything", { fetch: model.fetch, runTool: async () => alertsResult });
  assert.equal(result.answer, "Here is what I found.");
  assert.equal(result.steps.length, MAX_ROUNDS);
  assert.equal(model.sent.at(-1)?.toolConfig.functionCallingConfig.mode, "NONE");
  assert.equal(model.sent[0].toolConfig.functionCallingConfig.mode, "AUTO");
});

test("model failures become clear errors", async () => {
  await assert.rejects(
    // Busy on both passes through the (one-model) list.
    askAgent("q?", { fetch: scriptedModel([new Response("{}", { status: 429 }), new Response("{}", { status: 429 })]).fetch, retryPauseMs: 0 }),
    (err: AgentError) => err.status === 502 && /busy/.test(err.message),
  );
  await assert.rejects(
    askAgent("q?", { fetch: scriptedModel([{ candidates: [{ content: { role: "model", parts: [] } }] }]).fetch }),
    (err: AgentError) => err.status === 502 && /no answer/.test(err.message),
  );
});

test("a busy model hands the question to the next one", async () => {
  config.geminiModels = ["gemini-busy", "gemini-free"];
  try {
    const urls: string[] = [];
    const model = scriptedModel([new Response("{}", { status: 503 }), text("Almyros has an alert.")]);
    const answer = await askAgent("q?", {
      fetch: ((url: string, init: RequestInit) => (urls.push(url), model.fetch(url, init))) as typeof fetch,
    });
    assert.equal(answer.model, "gemini-free");
    assert.equal(answer.answer, "Almyros has an alert.");
    assert.deepEqual(urls.map((u) => /models\/([^:]+)/.exec(u)![1]), ["gemini-busy", "gemini-free"]);
    // A real failure is not retried on another model.
    await assert.rejects(
      askAgent("q?", { fetch: scriptedModel([new Response("{}", { status: 400 })]).fetch }),
      (err: AgentError) => /400/.test(err.message),
    );
  } finally {
    config.geminiModels = ["gemini-test"];
  }
});

test("without a key the agent answers 503", async () => {
  config.geminiApiKey = "";
  try {
    await assert.rejects(askAgent("q?"), (err: AgentError) => err.status === 503);
  } finally {
    config.geminiApiKey = "test-key";
  }
});

test("the system prompt keeps the model to the data and away from clinical advice", () => {
  const prompt = systemPrompt("2026-09-28");
  assert.match(prompt, /Today is 2026-09-28/);
  assert.match(prompt, /never invent/);
  assert.match(prompt, /no diagnosis, no treatment/);
  assert.match(prompt, /does not answer the question, say so/);
});

test("every tool is declared to the model with a JSON Schema object", () => {
  const declarations = functionDeclarations();
  assert.ok(declarations.some((d) => d.name === "search_fhir"));
  for (const d of declarations) {
    assert.equal(d.parametersJsonSchema.type, "object");
    assert.equal("$schema" in d.parametersJsonSchema, false);
  }
  const search = inputJsonSchema("search_fhir") as { required: string[] };
  assert.deepEqual(search.required, ["resourceType"]);
});

test("the generic search only reaches the app's own resource types and parameters", () => {
  assert.throws(() => guardSearch("Patient"), /not searchable/);
  assert.throws(() => guardSearch("Observation", { _has: "x" }), /not allowed/);
  assert.throws(() => guardSearch("Observation", { subject: "Location/x?_format=xml&y" }), /not allowed/);
  assert.deepEqual(guardSearch("DetectedIssue", { implicated: "Location/Loc-Almyros", _count: "500" }), {
    type: "DetectedIssue",
    params: { implicated: "Location/Loc-Almyros", _count: "20" },
  });
  assert.equal(guardSearch("Location").params._count, "10");
});

test("tool arguments are checked before anything runs", async () => {
  await assert.rejects(runTool("drop_tables", {}), /Unknown tool/);
  await assert.rejects(runTool("list_alerts", { siteId: 5 }), ToolInputError);
  await assert.rejects(runTool("list_sites", { extra: true }), ToolInputError);
});

test("resources are trimmed for the prompt and keep a link to the original", () => {
  const compact = compactResource({
    resourceType: "Observation",
    id: "42",
    meta: { lastUpdated: "2026-09-28" },
    text: { status: "generated", div: "<div/>" },
    note: [{ text: "x".repeat(400) }],
  } as fhir4.Observation);
  assert.equal("meta" in compact, false);
  assert.equal("text" in compact, false);
  assert.equal((compact.note as { text: string }[])[0].text.length, 301);
  assert.match(String(compact.url), /\/Observation\/42$/);
});

test("the guard limits questions per client per minute and per day, and reuses recent answers", () => {
  const guard = new AgentGuard(2, 3, 60_000);
  const t = Date.parse("2026-09-28T10:00:00Z");
  assert.equal(guard.admit("a", t), undefined);
  assert.equal(guard.admit("a", t + 1), undefined);
  assert.match(guard.admit("a", t + 2) ?? "", /at most 2 a minute/);
  assert.equal(guard.admit("a", t + 61_000), undefined);
  assert.match(guard.admit("b", t + 61_001) ?? "", /daily quota/);
  assert.equal(guard.admit("b", t + 86_400_000), undefined);

  const answer = { question: "Any alerts?", answer: "No.", steps: [], model: "m", answeredAt: "" };
  guard.remember(answer, t);
  assert.equal(guard.cached("  any ALERTS ", t + 1000), answer);
  assert.equal(guard.cached("any alerts", t + 60_001), undefined);
});
