"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowLeftIcon, MegaphoneIcon } from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { RISK_LEVELS, formatDateTime, formatValue } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import { TrendChart } from "./trend-chart";

interface Props {
  siteId: string;
  indicators: Indicator[];
  onBack: () => void;
}

export function SitePanel({ siteId, indicators, onBack }: Props) {
  const { data: site, error, loading } = useApi(useCallback(() => api.getSite(siteId), [siteId]));
  const indicatorById = new Map(indicators.map((i) => [i.id, i]));

  return (
    <div className="space-y-5 p-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeftIcon data-icon="inline-start" />
        All sites
      </Button>

      {loading && <LoadingRows rows={4} label="Loading site" />}
      {error && <LoadError error={error} what="this site" />}

      {site && (
        <>
          <header className="space-y-2">
            <h1 className="text-xl font-semibold">{site.name}</h1>
            <p className="text-sm text-muted-foreground">
              {site.waterBody} · {site.region}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge level={site.riskLevel} />
              <Link href={`/report?site=${encodeURIComponent(site.id)}`} className={buttonVariants({ size: "lg" })}>
                <MegaphoneIcon data-icon="inline-start" />
                Report here
              </Link>
            </div>
          </header>

          <section aria-labelledby="alerts-heading" className="space-y-2">
            <h2 id="alerts-heading" className="font-medium">
              Active alerts
            </h2>
            {site.alerts.length ? (
              [...site.alerts]
                .sort((x, y) => RISK_LEVELS.indexOf(y.level) - RISK_LEVELS.indexOf(x.level))
                .map((alert) => <AlertCard key={alert.id} alert={alert} showSite={false} />)
            ) : (
              <p className="text-sm text-muted-foreground">No active alerts for this site.</p>
            )}
          </section>

          <section aria-labelledby="latest-heading" className="space-y-2">
            <h2 id="latest-heading" className="font-medium">
              Latest readings
            </h2>
            {site.latest.length ? (
              <dl className="grid grid-cols-2 gap-2">
                {site.latest.map((o) => (
                  <div key={o.id} className="rounded-lg border p-2.5">
                    <dt className="text-xs text-muted-foreground">{indicatorById.get(o.indicator)?.display ?? o.indicator}</dt>
                    <dd className="text-base font-semibold">{formatValue(o, indicatorById.get(o.indicator))}</dd>
                    <dd className="text-xs text-muted-foreground">
                      <time dateTime={o.observedAt}>{formatDateTime(o.observedAt)}</time>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No readings yet. Be the first to report.</p>
            )}
          </section>

          <section aria-labelledby="trends-heading" className="space-y-4">
            <h2 id="trends-heading" className="font-medium">
              Trends
            </h2>
            {indicators
              .filter((i) => i.kind === "quantity")
              .map((indicator) => (
                <TrendChart
                  key={indicator.id}
                  indicator={indicator}
                  observations={site.observations.filter((o) => o.indicator === indicator.id)}
                />
              ))}
          </section>

          {site.clinics.length > 0 && (
            <section aria-labelledby="clinics-heading" className="space-y-1">
              <h2 id="clinics-heading" className="font-medium">
                Clinics notified for this site
              </h2>
              <ul className="text-sm text-muted-foreground">
                {site.clinics.map((c) => (
                  <li key={c.id}>
                    {c.name}, {c.city}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
