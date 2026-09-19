import assert from "node:assert/strict";
import { test } from "node:test";
import type { ObservationSummary } from "../src/mapping.js";
import { evaluateRisks, highestLevel, type RiskId } from "../src/rules.js";

const now = new Date("2026-09-19T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
let seq = 0;
const obs = (indicator: ObservationSummary["indicator"], value: ObservationSummary["value"], ago = 1): ObservationSummary => ({
  id: `o${++seq}`,
  indicator,
  value,
  observedAt: hoursAgo(ago),
  reporter: "test",
});
const decision = (risk: RiskId, ...args: Parameters<typeof evaluateRisks>) =>
  evaluateRisks(...args).find((d) => d.risk === risk)!;

const dry = { rain24h: 0, rain7d: 1.2, source: "test" };
const wet = { rain24h: 25, rain7d: 40, source: "test" };

test("algal bloom fires on algae, warm water and a dry week", () => {
  const algae = obs("filamentousAlgae", "present");
  const temp = obs("waterTemperature", 27);
  const d = decision("algal-bloom", [algae, temp], dry, now);
  assert.equal(d.fired, true);
  assert.equal(d.level, "medium");
  assert.equal(d.conditions.length, 3);
  assert.deepEqual(d.conditions.flatMap((c) => c.evidence), [algae.id, temp.id]);
  assert.equal(d.conditions[2]!.text, "Dry week: 1.2 mm of rain in the last 7 days, at most 5 mm (test).");
  assert.equal(decision("algal-bloom", [obs("filamentousAlgae", "abundant"), temp], dry, now).level, "high");
});

test("algal bloom does not fire when a condition fails, and says why", () => {
  const cool = decision("algal-bloom", [obs("filamentousAlgae", "present"), obs("waterTemperature", 22)], dry, now);
  assert.equal(cool.fired, false);
  assert.equal(cool.level, "none");
  assert.match(cool.conditions[1]!.text, /below 25 °C/);

  const rainy = decision("algal-bloom", [obs("filamentousAlgae", "present"), obs("waterTemperature", 27)], wet, now);
  assert.equal(rainy.fired, false);

  const absent = decision("algal-bloom", [obs("filamentousAlgae", "absent"), obs("waterTemperature", 27)], dry, now);
  assert.equal(absent.fired, false);
  assert.match(absent.conditions[0]!.text, /was absent/);
});

test("only the latest report within 7 days counts", () => {
  const cleared = [obs("filamentousAlgae", "present", 30), obs("filamentousAlgae", "absent", 2), obs("waterTemperature", 27)];
  assert.equal(decision("algal-bloom", cleared, dry, now).fired, false);
  const stale = [obs("filamentousAlgae", "present", 8 * 24), obs("waterTemperature", 27)];
  assert.equal(decision("algal-bloom", stale, dry, now).fired, false);
});

test("missing weather is reported and blocks weather-dependent rules", () => {
  const d = decision("algal-bloom", [obs("filamentousAlgae", "present"), obs("waterTemperature", 27)], undefined, now);
  assert.equal(d.fired, false);
  assert.match(d.conditions[2]!.text, /weather service is unavailable/);
});

test("sewage overflow needs heavy rain and foam within 48 hours", () => {
  assert.equal(decision("sewage-overflow", [obs("foam", "present", 10)], wet, now).fired, true);
  assert.equal(decision("sewage-overflow", [obs("foam", "present", 60)], wet, now).fired, false);
  assert.equal(decision("sewage-overflow", [obs("foam", "present", 10)], dry, now).fired, false);
});

test("mosquito breeding needs diptera, water at least 20 °C and recent rain", () => {
  const found = [obs("diptera", "present"), obs("waterTemperature", 21)];
  assert.equal(decision("mosquito-breeding", found, wet, now).fired, true);
  assert.equal(decision("mosquito-breeding", found, { rain24h: 0, rain7d: 0, source: "test" }, now).fired, false);
});

test("low oxygen fires below 4 mg/L without weather", () => {
  assert.equal(decision("low-oxygen", [obs("dissolvedO2", 3.7)], undefined, now).level, "low");
  assert.equal(decision("low-oxygen", [obs("dissolvedO2", 1.5)], undefined, now).level, "medium");
  assert.equal(decision("low-oxygen", [obs("dissolvedO2", 6)], undefined, now).fired, false);
});

test("highestLevel picks the most severe level", () => {
  assert.equal(highestLevel([]), "none");
  assert.equal(highestLevel(["low", "high", "medium"]), "high");
});
