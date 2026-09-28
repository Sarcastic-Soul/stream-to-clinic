import { T } from "@/components/t";
import { FHIR_URL, REPO_URL } from "@/lib/api";
import { ApiStatus } from "./api-status";

const linkClass = "underline underline-offset-2 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground/80">
            <T k="common.footer.disclaimer" />
          </p>
          <p>
            <T k="common.footer.credits" /> ©{" "}
            <a className={linkClass} href="https://www.openstreetmap.org/copyright">
              OpenStreetMap
            </a>
            ,{" "}
            <a className={linkClass} href="https://openfreemap.org">
              OpenFreeMap
            </a>
            ,{" "}
            <a className={linkClass} href="https://openmaptiles.org">
              OpenMapTiles
            </a>
            {" · "}
            <T k="common.footer.weather" />{" "}
            <a className={linkClass} href="https://open-meteo.com">
              Open-Meteo
            </a>{" "}
            (
            <a className={linkClass} href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </a>
            ). <T k="common.footer.sites" />
          </p>
        </div>
        <div className="space-y-1 sm:text-right">
          <ApiStatus />
          <p>
            <a className={linkClass} href={`${FHIR_URL}/metadata`}>
              <T k="common.footer.fhir" />
            </a>
            {" · "}
            <a className={linkClass} href={REPO_URL}>
              <T k="common.footer.source" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
