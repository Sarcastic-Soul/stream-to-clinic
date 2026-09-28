import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { config } from "../src/config.js";
import { fhir } from "../src/fhir.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const page = (ids: string[], next?: string): fhir4.Bundle => ({
  resourceType: "Bundle",
  type: "searchset",
  entry: ids.map((id) => ({ resource: { resourceType: "Communication", id, status: "completed" } })),
  ...(next ? { link: [{ relation: "next", url: next }] } : {}),
});

test("searchAll follows next links against our own base URL", async () => {
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => {
    asked.push(url);
    const body = asked.length === 1 ? page(["a", "b"], "https://public.example/fhir?_getpages=xyz&_getpagesoffset=2") : page(["c"]);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

  const found = await fhir.searchAll("Communication", { _count: 2 });
  assert.deepEqual(
    found.map((c) => c.id),
    ["a", "b", "c"],
  );
  assert.equal(asked[1], `${config.fhirBaseUrl}?_getpages=xyz&_getpagesoffset=2`);
});

test("searchAll stops at max", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify(page(["a", "b"], "https://x/fhir?_getpages=1")), { status: 200 })) as typeof fetch;
  const found = await fhir.searchAll("Communication", {}, 3);
  assert.equal(found.length, 3);
});
