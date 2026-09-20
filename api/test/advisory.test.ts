import assert from "node:assert/strict";
import { test } from "node:test";
import type { AlertSummary } from "../src/alerts.js";
import {
  ADVISOR_DEVICE_ID,
  advisorDevice,
  buildPrompt,
  toAdvisory,
  toAdvisoryCommunication,
  toAdvisoryProvenance,
} from "../src/advisory.js";

const alert: AlertSummary = {
  id: "1225",
  risk: "algal-bloom",
  title: "Possible algal bloom",
  level: "medium",
  siteId: "Loc-Almyros",
  siteName: "Almyros monitoring reach",
  createdAt: "2026-09-19T08:00:00Z",
  status: "active",
  reasons: ["Filamentous algae reported as abundant on 19 Sep."],
  narrative: ["Reviewed 49 citizen reports.", "All 3 conditions were met."],
  watchFor: "Skin irritation after contact with stream water.",
  evidence: ["obs-1"],
  acknowledgements: [],
  fhir: { detectedIssue: "https://example.org/fhir/DetectedIssue/1225", communications: [] },
};

test("the prompt carries the engine's own reasons and forbids inventing facts", () => {
  const prompt = buildPrompt(alert);
  assert.match(prompt, /Possible algal bloom/);
  assert.match(prompt, /Filamentous algae reported as abundant on 19 Sep\./);
  assert.match(prompt, /1\. Reviewed 49 citizen reports\./);
  assert.match(prompt, /Use only the facts above/);
  assert.match(prompt, /no treatment and no medication advice/);
});

test("an environmental-only alert says so instead of leaving the line blank", () => {
  const prompt = buildPrompt({ ...alert, watchFor: "" });
  assert.match(prompt, /Watch for: environmental risk only/);
});

test("the advisory is a Communication sent by the model Device, about the alert", () => {
  const comm = toAdvisoryCommunication(alert, "Text of the notice.", "gemini-test", "2026-09-20T10:00:00Z");
  assert.equal(comm.status, "completed");
  assert.equal(comm.sender?.reference, `Device/${ADVISOR_DEVICE_ID}`);
  assert.equal(comm.sender?.display, "gemini-test");
  assert.deepEqual(comm.about, [{ reference: "DetectedIssue/1225" }]);
  assert.equal(comm.payload?.[0]?.contentString, "Text of the notice.");
});

test("machine-written text carries a Provenance naming the Device as author", () => {
  const provenance = toAdvisoryProvenance("c-1", alert, "gemini-test", "2026-09-20T10:00:00Z");
  assert.deepEqual(provenance.target, [{ reference: "Communication/c-1" }]);
  assert.equal(provenance.agent[0].who.reference, `Device/${ADVISOR_DEVICE_ID}`);
  assert.equal(provenance.agent[0].type?.coding?.[0]?.code, "author");
  assert.deepEqual(provenance.entity?.[0]?.what, { reference: "DetectedIssue/1225" });
});

test("only a Communication from the model Device reads back as an advisory", () => {
  const comm = { ...toAdvisoryCommunication(alert, "Text.", "gemini-test", "2026-09-20T10:00:00Z"), id: "c-1" };
  assert.equal(toAdvisory(comm)?.text, "Text.");
  assert.equal(toAdvisory({ ...comm, sender: { reference: "Organization/clinic-almyros" } }), undefined);
  assert.equal(toAdvisory({ ...comm, payload: [] }), undefined);
});

test("the Device says what it does and what it does not decide", () => {
  const device = advisorDevice("gemini-test");
  assert.equal(device.id, ADVISOR_DEVICE_ID);
  assert.match(device.deviceName?.[0]?.name ?? "", /gemini-test/);
  assert.match(device.note?.[0]?.text ?? "", /deterministic rule engine/);
});
