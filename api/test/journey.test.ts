import assert from "node:assert/strict";
import { test } from "node:test";
import type { Communications } from "../src/alerts.js";
import { citesObservation, toJourneyAlert, toJourneyProvenance } from "../src/journey.js";
import { RISK_SYSTEM } from "../src/oah.js";

const issue: fhir4.DetectedIssue = {
  resourceType: "DetectedIssue",
  id: "di1",
  status: "final",
  code: { coding: [{ system: RISK_SYSTEM, code: "mosquito-breeding" }], text: "Mosquito breeding conditions" },
  severity: "moderate",
  identifiedPeriod: { start: "2026-09-28T10:00:00.000Z" },
  implicated: [{ reference: "Location/Loc-Giofyros", display: "Giofyros monitoring reach" }],
  evidence: [
    { code: [{ text: "Diptera reported as present." }], detail: [{ reference: "Observation/o1" }] },
    { code: [{ text: "Water is 21 °C." }], detail: [{ reference: "Observation/o2" }] },
  ],
  mitigation: [{ action: { text: "Fever with rash." } }],
};

test("citesObservation looks through every evidence entry", () => {
  assert.equal(citesObservation(issue, "o2"), true);
  assert.equal(citesObservation(issue, "o3"), false);
  assert.equal(citesObservation({ ...issue, evidence: undefined }, "o1"), false);
});

test("toJourneyAlert lists the clinics told, oldest first, with their replies", () => {
  const comms: Communications = new Map([
    [
      "di1",
      {
        sent: [
          { id: "c2", clinicId: "clinic-b", clinicName: "Clinic B", at: "2026-09-28T10:00:02.000Z" },
          { id: "c1", clinicId: "clinic-a", clinicName: "Clinic A", at: "2026-09-28T10:00:01.000Z" },
        ],
        replies: [],
      },
    ],
  ]);
  const alert = toJourneyAlert(issue, comms);
  assert.ok(alert);
  assert.deepEqual(
    alert.notified.map((n) => n.clinicName),
    ["Clinic A", "Clinic B"],
  );
  assert.match(alert.notified[0].fhirUrl, /\/Communication\/c1$/);
  assert.equal(alert.advisory, undefined);
  assert.equal(toJourneyAlert({ ...issue, code: undefined }, comms), undefined);
});

test("toJourneyProvenance keeps who was involved and when", () => {
  const p = toJourneyProvenance({
    resourceType: "Provenance",
    id: "p1",
    target: [{ reference: "Observation/o1" }],
    recorded: "2026-09-28T10:00:00.000Z",
    agent: [{ who: { display: "Maria S." } }, { who: { display: "Stream-to-Clinic (citizen report app)" } }],
  });
  assert.deepEqual(p?.agents, ["Maria S.", "Stream-to-Clinic (citizen report app)"]);
  assert.match(p?.fhirUrl ?? "", /\/Provenance\/p1$/);
  assert.equal(toJourneyProvenance(undefined), undefined);
});
