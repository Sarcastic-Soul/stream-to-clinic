import assert from "node:assert/strict";
import { test } from "node:test";
import type { ObservationSummary } from "../src/mapping.js";
import { clampDays, regionTrends, trendFor, TREND_DAYS, type SiteTrend } from "../src/trends.js";

const to = Date.parse("2026-09-19T12:00:00Z");
let seq = 0;
const obs = (indicator: ObservationSummary["indicator"], value: ObservationSummary["value"], daysAgo: number): ObservationSummary => ({
  id: `o${++seq}`,
  indicator,
  value,
  observedAt: new Date(to - daysAgo * 86_400_000).toISOString(),
  reporter: "Tester",
});

test("a quantity trend compares the two halves of the window", () => {
  const observations = [
    obs("dissolvedO2", 8, 26),
    obs("dissolvedO2", 7.8, 22),
    obs("dissolvedO2", 5.2, 6),
    obs("dissolvedO2", 4.8, 2),
  ];
  const trend = trendFor("dissolvedO2", observations);
  assert.ok(trend);
  assert.equal(trend.kind, "quantity");
  assert.equal(trend.unitLabel, "mg/L");
  assert.equal(trend.reports, 4);
  assert.equal(trend.earlier, 7.9);
  assert.equal(trend.recent, 5);
  assert.equal(trend.change, -2.9);
  assert.equal(trend.direction, "falling");
});

test("small movements stay steady, so noise does not read as a trend", () => {
  const trend = trendFor("pH", [obs("pH", 7.6, 20), obs("pH", 7.62, 4)]);
  assert.equal(trend?.direction, "steady");
});

test("a change that matters in the water counts even when the numbers are large", () => {
  // A tenth of 23 °C would be 2.3 °C; 1 °C in four weeks is a warming stream, not noise.
  const trend = trendFor("waterTemperature", [obs("waterTemperature", 23, 20), obs("waterTemperature", 24, 4)]);
  assert.equal(trend?.direction, "rising");
  // Conductivity moves in hundreds, so 20 µS/cm is still nothing.
  const flat = trendFor("conductivity", [obs("conductivity", 1100, 20), obs("conductivity", 1120, 4)]);
  assert.equal(flat?.direction, "steady");
});

test("readings on the same day are averaged into one point", () => {
  const trend = trendFor("waterTemperature", [obs("waterTemperature", 20, 3), obs("waterTemperature", 22, 3)]);
  assert.deepEqual(trend?.points, [{ date: new Date(to - 3 * 86_400_000).toISOString().slice(0, 10), value: 21 }]);
});

test("a presence trend counts the days something was seen", () => {
  const trend = trendFor("diptera", [obs("diptera", "present", 5), obs("diptera", "absent", 3), obs("diptera", "abundant", 1)]);
  assert.equal(trend?.kind, "presence");
  assert.equal(trend?.direction, "steady");
  assert.deepEqual(
    trend?.points.map((p) => p.value),
    [1, 0, 1],
  );
});

test("an indicator nobody reported has no trend", () => {
  assert.equal(trendFor("conductivity", [obs("pH", 7.4, 2)]), undefined);
});

test("a single reading has no direction to give", () => {
  const trend = trendFor("waterTemperature", [obs("waterTemperature", 21, 2)]);
  assert.equal(trend?.direction, "steady");
  assert.equal(trend?.change, undefined);
});

test("the halves follow the readings, not the requested window", () => {
  // Three days of reports inside a 28-day window still split into an earlier and a recent half.
  const trend = trendFor("waterTemperature", [obs("waterTemperature", 20, 3), obs("waterTemperature", 24, 1)]);
  assert.equal(trend?.earlier, 20);
  assert.equal(trend?.recent, 24);
  assert.equal(trend?.direction, "rising");
});

const site = (region: string, riskLevel: SiteTrend["riskLevel"], reports: number, answered: boolean): SiteTrend => ({
  siteId: `s${++seq}`,
  name: `Site ${seq}`,
  waterBody: "Stream",
  region,
  reports,
  reporters: 1,
  riskLevel,
  activeAlerts: riskLevel === "none" ? [] : [{ id: `a${seq}`, title: "Alert", level: riskLevel, answered }],
  indicators: [],
  health: [],
});

test("regions roll up their sites", () => {
  const regions = regionTrends([
    site("Crete, Greece", "medium", 49, true),
    site("Crete, Greece", "none", 49, false),
    site("Campania, Italy", "low", 20, false),
  ]);
  assert.deepEqual(
    regions.map((r) => r.region),
    ["Campania, Italy", "Crete, Greece"],
  );
  const crete = regions[1];
  assert.equal(crete.sites, 2);
  assert.equal(crete.reports, 98);
  assert.equal(crete.sitesAtRisk, 1);
  assert.equal(crete.activeAlerts, 1);
  assert.equal(crete.answeredAlerts, 1);
});

test("the window is clamped to a sane range", () => {
  assert.equal(clampDays(undefined), TREND_DAYS.default);
  assert.equal(clampDays("nonsense"), TREND_DAYS.default);
  assert.equal(clampDays(1), TREND_DAYS.min);
  assert.equal(clampDays(365), TREND_DAYS.max);
  assert.equal(clampDays(30), 30);
});
