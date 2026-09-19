import assert from "node:assert/strict";
import { test } from "node:test";
import { summariseRain } from "../src/weather.js";

test("summariseRain sums rolling 24-hour and 7-day windows up to now", () => {
  const now = Date.parse("2026-09-19T12:00:00Z");
  const time: string[] = [];
  const precipitation: (number | null)[] = [];
  for (let h = -200; h <= 12; h++) {
    time.push(new Date(now + h * 3_600_000).toISOString().slice(0, 16));
    // Future hours (forecast) and hours older than 7 days must be ignored.
    precipitation.push(h > 0 ? 50 : h > -24 ? 1 : h > -168 ? 0.5 : 9);
  }
  // 24 h window: hours -23..0 = 24 mm. 7 days: 24 + 144 * 0.5 = 96 mm.
  assert.deepEqual(summariseRain({ hourly: { time, precipitation } }, now), { rain24h: 24, rain7d: 96, source: "Open-Meteo" });
});
