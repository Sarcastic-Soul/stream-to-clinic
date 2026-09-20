import assert from "node:assert/strict";
import { test } from "node:test";
import { toProvenance } from "../src/provenance.js";

test("toProvenance names the reporter as author and the app as assembler", () => {
  const p = toProvenance(["Observation/o1", "Media/m1"], "Maria K.", "2026-09-20T10:00:00.000Z");

  assert.equal(p.resourceType, "Provenance");
  assert.deepEqual(
    p.target.map((t) => t.reference),
    ["Observation/o1", "Media/m1"],
  );
  assert.equal(p.recorded, "2026-09-20T10:00:00.000Z");
  assert.equal(p.activity?.coding?.[0]?.code, "CREATE");

  const roles = p.agent.map((a) => a.type?.coding?.[0]?.code);
  assert.deepEqual(roles, ["author", "assembler"]);
  assert.equal(p.agent[0].who.display, "Maria K.");
});
