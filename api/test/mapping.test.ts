import assert from "node:assert/strict";
import { test } from "node:test";
import { checkValue, resolveObservedAt, toObservationSummary, toOahObservation } from "../src/mapping.js";
import { OAH_CODE_SYSTEM, OAH_PROFILES, PRESENCE_SYSTEM, indicatorList } from "../src/oah.js";

const base = { siteId: "Loc-Almyros", observedAt: "2026-09-19T08:30:00Z", reporter: "Maria" };

test("quantity report maps to ObservationIndicatorsOah with a UCUM quantity", () => {
  const obs = toOahObservation({ ...base, indicator: "waterTemperature", value: 27.2, note: "warm" });
  assert.deepEqual(obs.meta?.profile, [OAH_PROFILES.observationIndicators]);
  assert.equal(obs.status, "final");
  assert.deepEqual(obs.code.coding?.[0], { system: OAH_CODE_SYSTEM, code: "waterTemperature", display: "Water temperature" });
  assert.equal(obs.subject?.reference, "Location/Loc-Almyros");
  assert.deepEqual(obs.valueQuantity, { value: 27.2, unit: "°C", system: "http://unitsofmeasure.org", code: "Cel" });
  assert.equal(obs.performer?.[0]?.display, "Maria");
  assert.equal(obs.note?.[0]?.text, "warm");
});

test("presence report maps to a coded value and uses the OAH code override", () => {
  const obs = toOahObservation({ ...base, indicator: "filamentousAlgae", value: "abundant" });
  assert.equal(obs.code.coding?.[0]?.code, "filamentous-algae");
  assert.equal(obs.valueQuantity, undefined);
  assert.deepEqual(obs.valueCodeableConcept?.coding?.[0], { system: PRESENCE_SYSTEM, code: "abundant", display: "Abundant" });
});

test("observations round-trip to summaries", () => {
  for (const [indicator, value] of [["pH", 7.4], ["foam", "present"]] as const) {
    const summary = toObservationSummary({ ...toOahObservation({ ...base, indicator, value }), id: "42" });
    assert.equal(summary?.indicator, indicator);
    assert.equal(summary?.value, value);
    assert.equal(summary?.reporter, "Maria");
  }
  const health: fhir4.Observation = {
    resourceType: "Observation",
    id: "1",
    status: "final",
    code: { coding: [{ system: OAH_CODE_SYSTEM, code: "gastrointestinal" }] },
  };
  assert.equal(toObservationSummary(health), undefined);
});

test("checkValue enforces kind and range", () => {
  assert.equal(checkValue("waterTemperature", 20), undefined);
  assert.match(checkValue("waterTemperature", 80) ?? "", /between 0 and 40/);
  assert.match(checkValue("waterTemperature", "present") ?? "", /number/);
  assert.equal(checkValue("diptera", "absent"), undefined);
  assert.match(checkValue("diptera", 3) ?? "", /absent, present, abundant/);
});

test("indicator list exposes kind and units", () => {
  const list = indicatorList();
  assert.deepEqual(list.find((i) => i.id === "dissolvedO2"), {
    id: "dissolvedO2", display: "Dissolved O2", kind: "quantity", unit: "mg/L", unitLabel: "mg/L", min: 0, max: 20,
  });
  assert.deepEqual(list.find((i) => i.id === "foam"), { id: "foam", display: "Foam/colour/smell", kind: "presence" });
});

test("observedAt defaults to now, clamps a fast clock up to 24 h, and rejects beyond", () => {
  const now = new Date("2026-09-20T10:00:00Z");
  assert.equal(resolveObservedAt(undefined, now), now.toISOString());
  assert.equal(resolveObservedAt("2026-09-20T09:00:00Z", now), "2026-09-20T09:00:00Z");
  assert.equal(resolveObservedAt("2026-09-20T10:07:00Z", now), now.toISOString());
  assert.equal(resolveObservedAt("2026-09-21T09:59:00Z", now), now.toISOString());
  assert.equal(resolveObservedAt("2026-09-21T10:01:00Z", now), undefined);
});
