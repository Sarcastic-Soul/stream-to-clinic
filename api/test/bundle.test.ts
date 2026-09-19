import assert from "node:assert/strict";
import { test } from "node:test";
import { toSiteBundle } from "../src/bundle.js";
import { config } from "../src/config.js";

test("site bundle is a timestamped collection with absolute fullUrls and no duplicates", () => {
  const location: fhir4.Location = { resourceType: "Location", id: "Loc-Almyros" };
  const media: fhir4.Media = { resourceType: "Media", id: "12", status: "completed", content: {} };
  const now = new Date("2026-09-20T10:00:00Z");
  const bundle = toSiteBundle([location, media, location, { resourceType: "Group" }], now);

  assert.equal(bundle.type, "collection");
  assert.equal(bundle.timestamp, now.toISOString());
  assert.ok(bundle.identifier?.value);
  assert.deepEqual(
    bundle.entry?.map((e) => e.fullUrl),
    [`${config.publicFhirUrl}/Location/Loc-Almyros`, `${config.publicFhirUrl}/Media/12`],
  );
});
