"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import MapGL, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { RISK } from "@/lib/format";
import type { SiteSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Copied into public/ by scripts/copy-maplibre-worker.mjs; the bundled default URL does not resolve.
setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

interface Props {
  sites: SiteSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Client-only: loaded with next/dynamic and ssr: false because MapLibre needs the browser.
export default function SiteMap({ sites, selectedId, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null);
  const selected = sites.find((s) => s.id === selectedId);

  useEffect(() => {
    if (selected) mapRef.current?.flyTo({ center: [selected.lon, selected.lat], zoom: 12, duration: 1200 });
  }, [selected]);

  const lons = sites.map((s) => s.lon);
  const lats = sites.map((s) => s.lat);
  const initialViewState = selected
    ? { longitude: selected.lon, latitude: selected.lat, zoom: 12 }
    : sites.length
      ? {
          bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as [number, number, number, number],
          fitBoundsOptions: { padding: 64, maxZoom: 12 },
        }
      : { longitude: 20, latitude: 38.5, zoom: 4 };

  return (
    <MapGL ref={mapRef} initialViewState={initialViewState} mapStyle={STYLE_URL} style={{ width: "100%", height: "100%" }}>
      <NavigationControl position="top-right" showCompass={false} />
      {sites.map((site) => {
        const isSelected = site.id === selectedId;
        return (
          <Marker key={site.id} longitude={site.lon} latitude={site.lat} anchor="center" style={{ zIndex: isSelected ? 2 : 1 }}>
            <button
              type="button"
              onClick={() => onSelect(site.id)}
              aria-label={`${site.name}, ${RISK[site.riskLevel].label}`}
              aria-pressed={isSelected}
              title={site.name}
              className={cn(
                "relative grid place-items-center rounded-full border-2 border-white shadow-md transition-transform outline-none focus-visible:ring-4 focus-visible:ring-sky-500",
                isSelected ? "size-8 ring-4 ring-black/30" : "size-6 hover:scale-110",
              )}
              style={{ backgroundColor: RISK[site.riskLevel].color }}
            >
              {site.riskLevel === "high" && (
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
                  style={{ backgroundColor: RISK.high.color }}
                  aria-hidden
                />
              )}
            </button>
          </Marker>
        );
      })}
    </MapGL>
  );
}
