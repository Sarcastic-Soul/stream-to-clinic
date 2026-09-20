import assert from "node:assert/strict";
import { test } from "node:test";
import { ACK_ACTIONS, toAcknowledgement } from "../src/alerts.js";
import { ACK_SYSTEM } from "../src/oah.js";

const reply = (over: Partial<fhir4.Communication> = {}): fhir4.Communication => ({
  resourceType: "Communication",
  id: "c9",
  status: "completed",
  topic: { coding: [{ system: ACK_SYSTEM, code: "staff-briefed" }] },
  inResponseTo: [{ reference: "Communication/c1" }],
  about: [{ reference: "DetectedIssue/d1" }],
  sender: { reference: "Organization/clinic-almyros", display: "Almyros Primary Care Unit (demo)" },
  sent: "2026-09-20T11:00:00.000Z",
  payload: [{ contentString: "Two cases seen this week." }],
  ...over,
});

test("toAcknowledgement reads the clinic, the coded action and the note", () => {
  const ack = toAcknowledgement(reply());

  assert.equal(ack?.clinicId, "clinic-almyros");
  assert.equal(ack?.action, "staff-briefed");
  assert.equal(ack?.actionLabel, ACK_ACTIONS["staff-briefed"]);
  assert.equal(ack?.note, "Two cases seen this week.");
  assert.equal(ack?.at, "2026-09-20T11:00:00.000Z");
  assert.match(ack?.fhirUrl ?? "", /\/Communication\/c9$/);
});

test("toAcknowledgement ignores an outbound alert, an unknown action and a missing sender", () => {
  assert.equal(toAcknowledgement(reply({ inResponseTo: undefined })), undefined);
  assert.equal(toAcknowledgement(reply({ topic: { coding: [{ system: ACK_SYSTEM, code: "nonsense" }] } })), undefined);
  assert.equal(toAcknowledgement(reply({ sender: { display: "Someone" } })), undefined);
});
