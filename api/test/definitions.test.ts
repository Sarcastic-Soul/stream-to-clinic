import assert from "node:assert/strict";
import { test } from "node:test";
import { ACK_ACTIONS } from "../src/alerts.js";
import { ACK_SYSTEM, PRESENCE_SYSTEM, PRESENCE_VALUES, RISK_SYSTEM, STC_PROFILES } from "../src/oah.js";
import { RISKS } from "../src/rules.js";
import { STC_DEFINITIONS } from "../src/seed.js";

// stc-definitions.json is built from ig/ (FSH); the codes there must be the ones the API writes.
const codes = (url: string) => {
  const cs = STC_DEFINITIONS.find((r): r is fhir4.CodeSystem => r.resourceType === "CodeSystem" && r.url === url);
  assert.ok(cs, `CodeSystem ${url} is defined`);
  return Object.fromEntries((cs.concept ?? []).map((c) => [c.code, c.display]));
};

test("FSH code systems match the codes the API writes", () => {
  assert.deepEqual(Object.keys(codes(PRESENCE_SYSTEM)), [...PRESENCE_VALUES]);
  assert.deepEqual(codes(RISK_SYSTEM), Object.fromEntries(Object.entries(RISKS).map(([code, r]) => [code, r.title])));
  assert.deepEqual(codes(ACK_SYSTEM), ACK_ACTIONS);
});

test("every profile the API declares is defined, with an id matching its canonical URL", () => {
  for (const url of Object.values(STC_PROFILES)) {
    const sd = STC_DEFINITIONS.find((r) => r.resourceType === "StructureDefinition" && r.url === url);
    assert.ok(sd, `StructureDefinition ${url} is defined`);
    // The seed PUTs each definition at its id, so the canonical URL resolves on the public server.
    assert.ok(url.endsWith(`/StructureDefinition/${sd.id}`));
  }
  for (const r of STC_DEFINITIONS) assert.ok(r.url?.endsWith(`/${r.resourceType}/${r.id}`), r.url);
});
