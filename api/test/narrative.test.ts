import assert from "node:assert/strict";
import { test } from "node:test";
import { toAlertSummary, toDetectedIssue } from "../src/alerts.js";
import { buildNarrative, parseNarrative } from "../src/narrative.js";
import type { RiskDecision } from "../src/rules.js";

const bloom: RiskDecision = {
  risk: "algal-bloom",
  fired: true,
  level: "high",
  levelReason: "filamentous algae was reported as abundant",
  conditions: [
    { text: "Filamentous algae reported as abundant on 18 Sep.", met: true, evidence: ["o1"] },
    { text: "Water temperature 27 °C on 18 Sep is at or above 25 °C.", met: true, evidence: ["o2"] },
    { text: "Dry week: 1.2 mm of rain in the last 7 days, at most 5 mm (Open-Meteo).", met: true, evidence: [] },
  ],
};
const site = { id: "Loc-Almyros", name: "Almyros monitoring reach", waterBody: "Almyros Stream", region: "Crete, Greece", lat: 35.3, lon: 25 };
const weather = { rain24h: 0, rain7d: 1.2, source: "Open-Meteo" };

test("narrative walks through reports, weather, each check, the level and who was notified", () => {
  const steps = buildNarrative({ decision: bloom, siteName: site.name, reportCount: 12, weather, clinics: ["Clinic A", "Clinic B"] });
  assert.deepEqual(steps, [
    "Reviewed 12 citizen reports from Almyros monitoring reach in the last 7 days.",
    "Weather from Open-Meteo: 0.0 mm of rain in the last 24 hours and 1.2 mm in the last 7 days.",
    "Check 1 of 3 (met): Filamentous algae reported as abundant on 18 Sep.",
    "Check 2 of 3 (met): Water temperature 27 °C on 18 Sep is at or above 25 °C.",
    "Check 3 of 3 (met): Dry week: 1.2 mm of rain in the last 7 days, at most 5 mm (Open-Meteo).",
    'All 3 conditions were met, so the engine raised "Possible algal bloom" at high level because filamentous algae was reported as abundant.',
    "Notified 2 clinics serving this site: Clinic A, Clinic B.",
  ]);
});

test("environmental risks skip weather and notify no clinic", () => {
  const lowOxygen: RiskDecision = {
    risk: "low-oxygen",
    fired: true,
    level: "low",
    levelReason: "dissolved oxygen is between 2 and 4 mg/L",
    conditions: [{ text: "Dissolved oxygen 3.7 mg/L on 18 Sep is below 4 mg/L.", met: true, evidence: ["o3"] }],
  };
  const steps = buildNarrative({ decision: lowOxygen, siteName: site.name, reportCount: 1, weather: undefined, clinics: [] });
  assert.equal(steps[0], "Reviewed 1 citizen report from Almyros monitoring reach in the last 7 days.");
  assert.ok(!steps.some((s) => s.startsWith("Weather")));
  assert.match(steps.at(-2)!, /^The condition was met/);
  assert.equal(steps.at(-1), "Environmental risk: no clinic notified.");
});

test("narrative survives the round trip through DetectedIssue.detail; old issues fall back to reasons", () => {
  const narrative = buildNarrative({ decision: bloom, siteName: site.name, reportCount: 3, weather, clinics: [] });
  const issue = { ...toDetectedIssue(site, bloom, "2026-09-19T10:00:00Z", narrative), id: "7" };
  assert.deepEqual(parseNarrative(issue.detail), narrative);
  assert.deepEqual(toAlertSummary(issue, new Map())?.narrative, narrative);

  const old = { ...toDetectedIssue(site, bloom, "2026-09-19T10:00:00Z"), id: "8" };
  const summary = toAlertSummary(old, new Map());
  assert.equal(summary?.reasons.length, 3);
  assert.deepEqual(summary?.narrative, summary?.reasons);
});
