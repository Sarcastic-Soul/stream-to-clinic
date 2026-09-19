import { FHIR_URL, REPO_URL } from "@/lib/api";
import { ApiStatus } from "./api-status";

const linkClass = "underline underline-offset-2 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:justify-between">
        <div className="space-y-1">
          <p>
            Map data ©{" "}
            <a className={linkClass} href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </a>
            , tiles by{" "}
            <a className={linkClass} href="https://openfreemap.org">
              OpenFreeMap
            </a>{" "}
            ©{" "}
            <a className={linkClass} href="https://openmaptiles.org">
              OpenMapTiles
            </a>
            .
          </p>
          <p>
            Weather data by{" "}
            <a className={linkClass} href="https://open-meteo.com">
              Open-Meteo.com
            </a>{" "}
            (
            <a className={linkClass} href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </a>
            ). Sites from the OneAquaHealth FHIR Implementation Guide examples.
          </p>
          <p>Alerts are demonstration heuristics, not clinical guidance.</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <ApiStatus />
          <p>
            <a className={linkClass} href={`${FHIR_URL}/metadata`}>
              Public FHIR R4 endpoint
            </a>
            {" · "}
            <a className={linkClass} href={REPO_URL}>
              Source on GitHub
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
