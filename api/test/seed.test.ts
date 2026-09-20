import assert from "node:assert/strict";
import { test } from "node:test";
import { OAH_PROFILES } from "../src/oah.js";
import { SITES, seedBundle } from "../src/seed.js";

const now = new Date("2026-09-19T12:00:00Z");

test("seed bundle is an idempotent transaction of PUTs with valid ids", () => {
  const bundle = seedBundle(now);
  assert.equal(bundle.type, "transaction");
  for (const entry of bundle.entry ?? []) {
    assert.equal(entry.request?.method, "PUT");
    assert.match(entry.resource?.id ?? "", /^[A-Za-z0-9\-.]{1,64}$/);
    assert.equal(entry.request?.url, `${entry.resource?.resourceType}/${entry.resource?.id}`);
  }
  // Same input, same resources: rerunning writes nothing new.
  assert.deepEqual(seedBundle(now), bundle);
});

test("sites are LocationOah with position, and history covers the last four weeks", () => {
  const resources = (seedBundle(now).entry ?? []).map((e) => e.resource!);
  const sites = resources.filter((r): r is fhir4.Location => r.resourceType === "Location" && !!r.meta?.profile);
  assert.equal(sites.length, SITES.length);
  for (const site of sites) {
    assert.deepEqual(site.meta?.profile, [OAH_PROFILES.location]);
    assert.equal(site.mode, "instance");
    assert.ok(site.identifier?.length && site.name && site.position);
  }
  const history = resources.filter(
    (r): r is fhir4.Observation => r.resourceType === "Observation" && !!r.id?.startsWith("seed-"),
  );
  assert.ok(history.length > 0);
  for (const o of history) {
    assert.deepEqual(o.meta?.profile, [OAH_PROFILES.observationIndicators]);
    const age = now.getTime() - Date.parse(o.effectiveDateTime!);
    assert.ok(age > 0 && age < 28 * 86_400_000);
  }
});
