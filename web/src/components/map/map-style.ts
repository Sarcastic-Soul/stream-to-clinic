import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { Theme } from "@/lib/theme";

// OpenFreeMap's two minimal basemaps: no points of interest, muted colours, so the
// site markers and risk colours stay the loudest thing on the map.
export const STYLE_URL: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// The shipped styles label places as "Ηράκλειο\nIraklio": the latin name and the
// local-script name stacked. One language is enough here, and English first.
const LATIN_NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:en"],
  ["get", "name:latin"],
  ["get", "name"],
];
const LATIN_NAME_JSON = JSON.stringify(LATIN_NAME);

export function applyOneLanguageLabels(map: MapLibreMap) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const textField = layer.layout?.["text-field"];
    if (!textField) continue;
    const current = JSON.stringify(textField);
    // Only the bilingual name labels; road shields and house numbers are left alone,
    // and our own replacement has no "name:nonlatin", so this never loops.
    if (!current.includes("name:nonlatin") || current === LATIN_NAME_JSON) continue;
    map.setLayoutProperty(layer.id, "text-field", LATIN_NAME);
  }
}
