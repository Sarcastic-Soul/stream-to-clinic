import { RISK_LEVELS, distanceKm } from "@/lib/format";
import type { RiskLevel, SiteSummary } from "@/lib/types";

export interface SiteCluster {
  id: string;
  lat: number;
  lon: number;
  sites: SiteSummary[];
  /** Worst risk in the group, so a cluster never hides an alert. */
  riskLevel: RiskLevel;
}

const EARTH_CIRCUMFERENCE_M = 40075016.686;

// MapLibre vector styles use 512 px tiles, hence 2^(zoom + 9).
export function metresPerPixel(latitude: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / 2 ** (zoom + 9);
}

const centreOf = (sites: SiteSummary[]) => ({
  lat: sites.reduce((sum, s) => sum + s.lat, 0) / sites.length,
  lon: sites.reduce((sum, s) => sum + s.lon, 0) / sites.length,
});

const worstRisk = (sites: SiteSummary[]): RiskLevel =>
  sites.reduce<RiskLevel>(
    (worst, s) => (RISK_LEVELS.indexOf(s.riskLevel) > RISK_LEVELS.indexOf(worst) ? s.riskLevel : worst),
    "none",
  );

/**
 * Groups sites that would be drawn on top of each other at this zoom, so nearby
 * sites (Crete has three within 8 km) stay countable instead of hiding one
 * another. The selected site is always kept on its own.
 */
export function clusterSites(
  sites: SiteSummary[],
  zoom: number,
  selectedId: string | null = null,
  radiusPx = 44,
): SiteCluster[] {
  const groups: SiteSummary[][] = [];

  for (const site of sites) {
    if (site.id === selectedId) {
      groups.push([site]);
      continue;
    }
    const near = groups.find((group) => {
      if (group.some((s) => s.id === selectedId)) return false;
      const centre = centreOf(group);
      return distanceKm(centre, site) * 1000 < radiusPx * metresPerPixel(centre.lat, zoom);
    });
    if (near) near.push(site);
    else groups.push([site]);
  }

  return groups.map((group) => ({
    id: group.map((s) => s.id).join("+"),
    ...centreOf(group),
    sites: group,
    riskLevel: worstRisk(group),
  }));
}
