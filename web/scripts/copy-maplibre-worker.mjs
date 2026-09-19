// MapLibre GL 6 loads its web worker from a file next to its own module (via import.meta.url),
// which bundlers rewrite. Serve the worker from public/ instead, in a versioned folder so caches
// never mix versions; site-map.tsx points setWorkerUrl() at it. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = dirname(fileURLToPath(import.meta.resolve("maplibre-gl")));
const { version } = JSON.parse(readFileSync(join(dist, "..", "package.json"), "utf8"));
const target = join(import.meta.dirname, "..", "public", "maplibre", version);

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
}
console.log(`Copied MapLibre ${version} worker to public/maplibre/${version}/`);
