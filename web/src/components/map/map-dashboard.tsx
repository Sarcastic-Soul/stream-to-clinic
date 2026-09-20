"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { RISK, RISK_LEVELS } from "@/lib/format";
import type { RiskLevel, SiteSummary } from "@/lib/types";
import { SitePanel } from "./site-panel";

const SiteMap = dynamic(() => import("./site-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export function MapDashboard() {
  const router = useRouter();
  const selectedId = useSearchParams().get("site");
  const sites = useApi(api.getSites);
  const indicators = useApi(api.getIndicators);

  const select = (id: string | null) =>
    router.replace(id ? `/?site=${encodeURIComponent(id)}` : "/", { scroll: false });

  return (
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[minmax(0,1fr)]">
      <section aria-label="Map of monitored stream sites" className="relative h-[55dvh] min-h-80 lg:h-full">
        {sites.data ? (
          <SiteMap sites={sites.data} selectedId={selectedId} onSelect={select} />
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
        {sites.data && <Legend sites={sites.data} />}
      </section>

      <aside aria-label="Site details" className="border-t lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {selectedId ? (
          <SitePanel key={selectedId} siteId={selectedId} indicators={indicators.data ?? []} onBack={() => select(null)} />
        ) : (
          <div className="space-y-4 p-4">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Stream sites</h1>
              <p className="text-sm text-muted-foreground">
                Citizen observations from OneAquaHealth sites. Pick a site on the map or in the list to see its readings
                and alerts.
              </p>
            </div>
            {sites.loading && <LoadingRows rows={4} label="Loading sites" />}
            {sites.error && <LoadError error={sites.error} what="sites" />}
            {sites.data && <SiteList sites={sites.data} onSelect={select} />}
          </div>
        )}
      </aside>
    </div>
  );
}

function SiteList({ sites, onSelect }: { sites: SiteSummary[]; onSelect: (id: string) => void }) {
  const regions = [...new Set(sites.map((s) => s.region))];
  return regions.map((region) => (
    <section key={region} className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{region}</h2>
      <ul className="space-y-2">
        {sites
          .filter((s) => s.region === region)
          .map((site) => (
            <li key={site.id}>
              <button
                type="button"
                onClick={() => onSelect(site.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{site.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {site.waterBody} · {site.latest.length} indicators
                  </span>
                </span>
                <RiskBadge level={site.riskLevel} />
              </button>
            </li>
          ))}
      </ul>
    </section>
  ));
}

// Doubles as a summary: how many sites sit at each risk level right now.
function Legend({ sites }: { sites: SiteSummary[] }) {
  const count = (level: RiskLevel) => sites.filter((s) => s.riskLevel === level).length;
  return (
    // bottom-9 on phones keeps it off the full-width map attribution bar.
    <div className="pointer-events-none absolute bottom-9 left-2 rounded-lg border bg-background/90 p-2 text-xs shadow-sm backdrop-blur sm:bottom-2">
      <p className="mb-1 font-medium">Sites by risk</p>
      <ul className="flex gap-2.5 sm:block sm:space-y-0.5">
        {RISK_LEVELS.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-full border border-white"
              style={{ backgroundColor: RISK[level].color }}
              aria-hidden
            />
            <span className="tabular-nums">{count(level)}</span>
            <span className="hidden text-muted-foreground sm:inline">{RISK[level].label.toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
