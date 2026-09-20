"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import MapGL, {
  GeolocateControl,
  Marker,
  NavigationControl,
  type MapEvent,
  type MapRef,
  type MapStyleDataEvent,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import { MaximizeIcon } from "lucide-react";
import { useTranslate } from "@/hooks/use-locale";
import { RISK } from "@/lib/format";
import type { SiteSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clusterSites, type SiteCluster } from "./cluster";
import { STYLE_URL, applyLabelStyle } from "./map-style";

// Copied into public/ by scripts/copy-maplibre-worker.mjs; the bundled default URL does not resolve.
setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

/** Zoom from which a lone site is worth naming on the map itself. */
const LABEL_FROM_ZOOM = 7;
const FIT_PADDING = { top: 64, bottom: 96, left: 72, right: 72 };

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function boundsOf(sites: SiteSummary[]): [number, number, number, number] {
  const lons = sites.map((s) => s.lon);
  const lats = sites.map((s) => s.lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

interface Props {
  sites: SiteSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Client-only: loaded with next/dynamic and ssr: false because MapLibre needs the browser.
export default function SiteMap({ sites, selectedId, onSelect }: Props) {
  const t = useTranslate();
  const [map, setMap] = useState<MapRef | null>(null);
  // Clustering depends on scale only, so the markers are recomputed on zoom, not on every pan frame.
  const [zoom, setZoom] = useState<number | null>(null);
  const selected = sites.find((s) => s.id === selectedId);

  const clusters = useMemo(
    () => (zoom === null ? [] : clusterSites(sites, zoom, selectedId)),
    [sites, zoom, selectedId],
  );

  const fitAll = useCallback(() => {
    if (!map || sites.length === 0) return;
    map.fitBounds(boundsOf(sites), { padding: FIT_PADDING, maxZoom: 11, duration: reduceMotion() ? 0 : 900 });
  }, [map, sites]);

  useEffect(() => {
    if (!selected || !map) return;
    map.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(map.getZoom(), 12), duration: reduceMotion() ? 0 : 1200 });
  }, [selected, map]);

  const initialViewState = selected
    ? { longitude: selected.lon, latitude: selected.lat, zoom: 12 }
    : sites.length
      ? { bounds: boundsOf(sites), fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 11 } }
      : { longitude: 20, latitude: 38.5, zoom: 4 };

  const openCluster = (cluster: SiteCluster) => {
    if (cluster.sites.length === 1) {
      onSelect(cluster.sites[0].id);
      return;
    }
    map?.fitBounds(boundsOf(cluster.sites), {
      padding: FIT_PADDING,
      maxZoom: 13,
      duration: reduceMotion() ? 0 : 700,
    });
  };

  return (
    <MapGL
      ref={setMap}
      initialViewState={initialViewState}
      mapStyle={STYLE_URL}
      style={{ width: "100%", height: "100%" }}
      minZoom={2}
      maxZoom={16}
      dragRotate={false}
      attributionControl={{ compact: true }}
      // On a phone the map sits inside a scrolling page: one finger scrolls the page,
      // two fingers move the map.
      cooperativeGestures={typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches}
      onLoad={(event: MapEvent) => {
        setZoom(event.target.getZoom());
        applyLabelStyle(event.target);
      }}
      onStyleData={(event: MapStyleDataEvent) => applyLabelStyle(event.target)}
      onZoom={(event: ViewStateChangeEvent) => setZoom(event.viewState.zoom)}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl position="top-right" />

      {sites.length > 1 && (
        <button
          type="button"
          onClick={fitAll}
          className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-900 shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-sky-500/50 focus-visible:outline-none"
        >
          <MaximizeIcon className="size-3.5" aria-hidden />
          {t("map.allSites")}
        </button>
      )}

      {clusters.map((cluster) => {
        const grouped = cluster.sites.length > 1;
        const isSelected = !grouped && cluster.sites[0].id === selectedId;
        const showLabel = !grouped && (isSelected || (zoom ?? 0) >= LABEL_FROM_ZOOM);
        const label = grouped
          ? `${cluster.sites.length} sites: ${cluster.sites.map((s) => s.name).join(", ")}`
          : `${cluster.sites[0].name}, ${RISK[cluster.riskLevel].label}`;

        return (
          <Marker
            key={cluster.id}
            longitude={cluster.lon}
            latitude={cluster.lat}
            anchor="center"
            style={{ zIndex: isSelected ? 3 : grouped ? 2 : 1 }}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => openCluster(cluster)}
                aria-label={label}
                aria-pressed={isSelected}
                title={label}
                className={cn(
                  "relative grid place-items-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-md transition-transform outline-none focus-visible:ring-4 focus-visible:ring-sky-500",
                  grouped ? "size-8 hover:scale-110" : isSelected ? "size-8 ring-4 ring-black/30" : "size-6 hover:scale-110",
                )}
                style={{ backgroundColor: RISK[cluster.riskLevel].color }}
              >
                {cluster.riskLevel === "high" && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
                    style={{ backgroundColor: RISK.high.color }}
                    aria-hidden
                  />
                )}
                {grouped && <span className="relative">{cluster.sites.length}</span>}
              </button>
              {showLabel && (
                <span
                  className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-medium text-slate-900 whitespace-nowrap shadow-sm backdrop-blur-[2px]"
                  aria-hidden
                >
                  {cluster.sites[0].name}
                </span>
              )}
            </div>
          </Marker>
        );
      })}
    </MapGL>
  );
}
