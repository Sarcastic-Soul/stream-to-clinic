import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

// One basemap for both app themes: Liberty keeps the green of parks and forests
// and the blue of rivers and sea, which is the point of a river-health map.
export const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// The shipped styles label places as "Ηράκλειο\nIraklio": the latin name and the
// local-script name stacked. One language is enough here, and English first.
const LATIN_NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:en"],
  ["get", "name:latin"],
  ["get", "name"],
];
const LATIN_NAME_JSON = JSON.stringify(LATIN_NAME);

// Liberty sets country and capital labels in bold at up to 17px, which shouts over
// the site markers. Regular weight at 85% keeps them readable but in the background.
const BOLD_FONT = "Noto Sans Bold";
const REGULAR_FONT = ["Noto Sans Regular"];
const LABEL_SCALE = 0.85;

export function applyLabelStyle(map: MapLibreMap) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const layout = layer.layout;
    if (!layout) continue;

    const textField = layout["text-field"];
    // Only the bilingual name labels; road shields and house numbers are left alone,
    // and our own replacement has no "name:nonlatin", so this never loops.
    if (textField) {
      const current = JSON.stringify(textField);
      if (current.includes("name:nonlatin") && current !== LATIN_NAME_JSON) {
        map.setLayoutProperty(layer.id, "text-field", LATIN_NAME);
      }
    }

    // As unknown: narrowing text-font in place makes TypeScript expand its union.
    const font: unknown = layout["text-font"];
    // Swapping the font away from bold is also the guard: on a repeat call (every
    // styledata event) the layer no longer matches, so the size is scaled once.
    if (!Array.isArray(font) || !font.includes(BOLD_FONT)) continue;
    map.setLayoutProperty(layer.id, "text-font", REGULAR_FONT);
    const textSize = layout["text-size"];
    if (textSize === undefined) continue;
    // Multiplying keeps whatever zoom curve the style author wrote; the cast is
    // needed because text-size is a union wide enough to defeat inference.
    const scaled: unknown = ["*", textSize as unknown, LABEL_SCALE];
    map.setLayoutProperty(layer.id, "text-size", scaled as ExpressionSpecification);
  }
}
