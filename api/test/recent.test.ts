import assert from "node:assert/strict";
import { test } from "node:test";
import { RecentIds } from "../src/recent.js";

test("remembers ids until their time to live runs out", () => {
  const recent = new RecentIds(120_000);
  recent.add("1229", 0);
  assert.ok(recent.has("1229", 119_999));
  assert.ok(!recent.has("1229", 120_000));
  assert.ok(!recent.has("1230", 0));
});

test("drops expired ids when new ones are added", () => {
  const recent = new RecentIds(1_000);
  recent.add("a", 0);
  recent.add("b", 5_000);
  assert.ok(!recent.has("a", 5_000));
  assert.ok(recent.has("b", 5_500));
});
