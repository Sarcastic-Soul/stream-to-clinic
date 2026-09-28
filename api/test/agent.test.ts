import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentError, AgentGuard, MAX_ROUNDS, askAgent, systemPrompt, toolSpecs } from "../src/agent.js";
import { ToolInputError, compactResource, guardSearch, inputJsonSchema, runTool, type ToolResult } from "../src/agent-tools.js";
import { config } from "../src/config.js";
import { DailyLimit, type ConverseRequest, type ConverseResponse } from "../src/llm.js";

config.bedrockModels = ["test-model"];

// An SDK-style error, as the Bedrock client throws them.
const failure = (name: string) => Object.assign(new Error(name), { name });

// A scripted model: each call returns the next reply (or throws it) and records what it was sent.
function scriptedModel(replies: (ConverseResponse | Error)[]) {
  const sent: ConverseRequest[] = [];
  const converse = async (request: ConverseRequest) => {
    // The agent keeps adding to the same message list, so keep a copy of it as sent.
    sent.push(structuredClone(request));
    const reply = replies.shift()!;
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { converse, sent };
}

const reply = (content: object[], stopReason: string) =>
  ({ output: { message: { role: "assistant", content } }, stopReason, $metadata: {} }) as unknown as ConverseResponse;
const call = (name: string, input: Record<string, unknown> = {}, toolUseId = "call-1") => reply([{ toolUse: { toolUseId, name, input } }], "tool_use");
const text = (value: string) => reply([{ text: value }], "end_turn");

const alertsResult: ToolResult = {
  summary: "Found 1 active alert",
  data: [{ id: "1225", title: "Possible algal bloom", level: "medium" }],
  fhirUrls: ["https://example.org/fhir/DetectedIssue?code=x%7C"],
};

test("the agent calls a tool, feeds the result back and answers with the steps it took", async () => {
  const model = scriptedModel([call("list_alerts", { siteId: "Loc-Almyros" }), text("One alert: a possible algal bloom at Almyros.")]);
  const calls: [string, unknown][] = [];
  const result = await askAgent("Any alerts at Almyros?", {
    converse: model.converse,
    runTool: async (name, args) => {
      calls.push([name, args]);
      return alertsResult;
    },
    now: () => new Date("2026-09-28T10:00:00Z"),
  });

  assert.equal(result.answer, "One alert: a possible algal bloom at Almyros.");
  assert.equal(result.model, "test-model");
  assert.equal(model.sent[0].modelId, "test-model");
  assert.deepEqual(calls, [["list_alerts", { siteId: "Loc-Almyros" }]]);
  assert.deepEqual(result.steps, [
    { tool: "list_alerts", args: { siteId: "Loc-Almyros" }, summary: alertsResult.summary, fhirUrls: alertsResult.fhirUrls },
  ]);

  // Second request: the model's own turn echoed back, then the tool result under the same id.
  const second = model.sent[1].messages!;
  assert.equal(second[1].role, "assistant");
  assert.equal(second[1].content![0].toolUse?.toolUseId, "call-1");
  assert.deepEqual(second[2].content![0], {
    toolResult: { toolUseId: "call-1", content: [{ text: JSON.stringify(alertsResult.data) }] },
  });
});

test("a refused tool call is shown as a failed step and reported to the model", async () => {
  const model = scriptedModel([call("search_fhir", { resourceType: "Patient" }), text("I can only read stream data.")]);
  const result = await askAgent("List patients", {
    converse: model.converse,
    runTool: async () => {
      throw new ToolInputError("Resource type Patient is not searchable here.");
    },
  });
  assert.equal(result.steps[0].error, true);
  assert.match(result.steps[0].summary, /Patient is not searchable/);
  const toolResult = model.sent[1].messages![2].content![0].toolResult!;
  assert.equal(toolResult.status, "error");
  assert.match(toolResult.content![0].text!, /not searchable/);
});

test("after the last tool round the model is told to answer without tools", async () => {
  const replies = [...Array.from({ length: MAX_ROUNDS }, (_, i) => call("list_sites", {}, `call-${i}`)), text("Here is what I found.")];
  const model = scriptedModel(replies);
  const result = await askAgent("Tell me everything", { converse: model.converse, runTool: async () => alertsResult });
  assert.equal(result.answer, "Here is what I found.");
  assert.equal(result.steps.length, MAX_ROUNDS);
  const last = model.sent.at(-1)!.messages!.at(-1)!.content!;
  assert.match(last.at(-1)!.text ?? "", /Do not call any more tools/);
  assert.equal(model.sent[0].messages!.length, 1);
});

test("model failures become clear errors", async () => {
  await assert.rejects(
    // Busy on both passes through the (one-model) list.
    askAgent("q?", { converse: scriptedModel([failure("ThrottlingException"), failure("ThrottlingException")]).converse, retryPauseMs: 0 }),
    (err: AgentError) => err.status === 502 && /busy/.test(err.message),
  );
  await assert.rejects(
    askAgent("q?", { converse: scriptedModel([reply([], "end_turn")]).converse }),
    (err: AgentError) => err.status === 502 && /no answer/.test(err.message),
  );
});

test("a busy model hands the question to the next one", async () => {
  config.bedrockModels = ["model-busy", "model-free"];
  try {
    const model = scriptedModel([failure("ServiceUnavailableException"), text("Almyros has an alert.")]);
    const answer = await askAgent("q?", { converse: model.converse });
    assert.equal(answer.model, "model-free");
    assert.equal(answer.answer, "Almyros has an alert.");
    assert.deepEqual(
      model.sent.map((r) => r.modelId),
      ["model-busy", "model-free"],
    );
    // A real failure is not retried on another model.
    await assert.rejects(
      askAgent("q?", { converse: scriptedModel([failure("ValidationException")]).converse }),
      (err: AgentError) => /ValidationException/.test(err.message),
    );
  } finally {
    config.bedrockModels = ["test-model"];
  }
});

test("without a model the agent answers 503", async () => {
  config.bedrockModels = [];
  try {
    await assert.rejects(askAgent("q?"), (err: AgentError) => err.status === 503);
  } finally {
    config.bedrockModels = ["test-model"];
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
  const specs = toolSpecs().map((t) => t.toolSpec!);
  assert.ok(specs.some((s) => s.name === "search_fhir"));
  for (const s of specs) {
    const schema = s.inputSchema!.json as Record<string, unknown>;
    assert.equal(schema.type, "object");
    assert.equal("$schema" in schema, false);
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

test("the guard limits questions per client per minute and reuses recent answers", () => {
  const guard = new AgentGuard(2, 60_000);
  const t = Date.parse("2026-09-28T10:00:00Z");
  assert.equal(guard.admit("a", t), undefined);
  assert.equal(guard.admit("a", t + 1), undefined);
  assert.match(guard.admit("a", t + 2) ?? "", /at most 2 a minute/);
  assert.equal(guard.admit("a", t + 61_000), undefined);
  assert.equal(guard.admit("b", t + 61_001), undefined);

  const answer = { question: "Any alerts?", answer: "No.", steps: [], model: "m", answeredAt: "" };
  guard.remember(answer, t);
  assert.equal(guard.cached("  any ALERTS ", t + 1000), answer);
  assert.equal(guard.cached("any alerts", t + 60_001), undefined);
});

test("the daily model budget runs out and comes back the next UTC day", () => {
  const limit = new DailyLimit(2);
  const t = Date.parse("2026-09-28T23:59:00Z");
  assert.equal(limit.take(t), true);
  assert.equal(limit.take(t), true);
  assert.equal(limit.take(t), false);
  assert.equal(limit.take(t + 120_000), true);
});
