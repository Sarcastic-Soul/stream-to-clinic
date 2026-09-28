// Collects the conformance resources SUSHI built from ../ig (profiles, code systems, value sets;
// not the examples) into one JSON file the API seeds into the FHIR server, so every canonical
// URL of the Stream-to-Clinic profiles resolves on the public server.
// Usage: node export-definitions.mjs <sushi resources dir> <output file>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, out] = process.argv.slice(2);
const KINDS = ["CodeSystem", "ValueSet", "StructureDefinition"];

const definitions = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")))
  .filter((resource) => KINDS.includes(resource.resourceType))
  .sort((a, b) => KINDS.indexOf(a.resourceType) - KINDS.indexOf(b.resourceType) || a.id.localeCompare(b.id));

writeFileSync(out, `${JSON.stringify(definitions, null, 2)}\n`);
console.log(`Wrote ${definitions.length} definitions to ${out}`);
