"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, ExternalLinkIcon } from "lucide-react";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkline } from "@/components/trends/sparkline";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { IndicatorTrend, RegionTrend, SiteTrend, Trends } from "@/lib/types";

const WINDOWS = [14, 28, 90];

// Which way a reading has to move before it is worth a clinician's attention. The rules behind the
// alerts use absolute thresholds; this is the same idea one step earlier — a stream drifting
// towards a threshold, before it crosses one.
const WATCH: Record<string, { direction: "rising" | "falling"; why: string }> = {
  waterTemperature: { direction: "rising", why: "warming water feeds algal blooms and mosquitoes" },
  dissolvedO2: { direction: "falling", why: "falling oxygen suffocates stream life" },
  conductivity: { direction: "rising", why: "rising conductivity can mean an inflow of waste water" },
};

const ARROW = {
  rising: ArrowUpRightIcon,
  falling: ArrowDownRightIcon,
  steady: ArrowRightIcon,
} as const;

const DIRECTION_WORD = { rising: "Rising", falling: "Falling", steady: "Steady" } as const;

function formatRange(trends: Trends): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${format(trends.from)} – ${format(trends.to)}`;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-card-foreground">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function RegionRow({ region }: { region: RegionTrend }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
      <p className="font-medium">{region.region}</p>
      <p className="text-sm text-muted-foreground">
        {region.sites === 1 ? "1 site" : `${region.sites} sites`} · {region.reports} reports ·{" "}
        {region.sitesAtRisk === 0 ? "none under alert" : `${region.sitesAtRisk} under alert`}
        {region.activeAlerts > 0 && ` · ${region.answeredAlerts} of ${region.activeAlerts} alerts answered`}
      </p>
    </div>
  );
}

function IndicatorRow({ trend }: { trend: IndicatorTrend }) {
  const watch = WATCH[trend.indicator];
  const notable = watch?.direction === trend.direction;
  const Arrow = ARROW[trend.direction];
  const unit = trend.unitLabel && trend.unitLabel !== "pH" ? ` ${trend.unitLabel}` : "";
  const days = trend.points.filter((p) => p.value > 0).length;

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{trend.display}</p>
        {trend.kind === "quantity" && trend.earlier !== undefined && trend.recent !== undefined ? (
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">
              {trend.earlier}
              {unit}
            </span>{" "}
            earlier,{" "}
            <span className="tabular-nums">
              {trend.recent}
              {unit}
            </span>{" "}
            lately
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {trend.kind === "presence"
              ? days === 0
                ? `Never seen in ${trend.reports === 1 ? "1 check" : `${trend.reports} checks`}`
                : `Seen on ${days} of ${trend.points.length === 1 ? "1 day" : `${trend.points.length} days`} checked`
              : `${trend.reports === 1 ? "1 reading" : `${trend.reports} readings`}`}
          </p>
        )}
      </div>
      <Sparkline points={trend.points} color={notable ? "#d97706" : "#64748b"} />
      <p
        className={`inline-flex w-28 shrink-0 items-center justify-end gap-1 text-sm ${
          notable ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"
        }`}
      >
        <Arrow className="size-4" aria-hidden />
        {DIRECTION_WORD[trend.direction]}
      </p>
    </li>
  );
}

function SiteCard({ site }: { site: SiteTrend }) {
  const watched = site.indicators.filter((i) => WATCH[i.indicator]?.direction === i.direction);
  return (
    <section aria-labelledby={`site-${site.siteId}`} className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`site-${site.siteId}`} className="font-semibold">
            {site.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {site.waterBody} · {site.region}
          </p>
        </div>
        <RiskBadge level={site.riskLevel} />
      </div>

      <p className="text-sm text-muted-foreground">
        {site.reports} reports from {site.reporters === 1 ? "1 reporter" : `${site.reporters} reporters`}
        {site.health[0] && (
          <>
            {" · district baseline "}
            <span className="tabular-nums">
              {site.health[0].value}
              {site.health[0].unit}
            </span>{" "}
            gastrointestinal disease ({site.health[0].period})
          </>
        )}
      </p>

      {site.activeAlerts.length > 0 && (
        <ul className="space-y-1">
          {site.activeAlerts.map((alert) => (
            <li key={alert.id} className="text-sm">
              <Link href={`/alerts/${encodeURIComponent(alert.id)}`} className="underline underline-offset-2">
                {alert.title}
              </Link>
              {alert.answered ? " · answered by a clinic" : " · awaiting a clinic reply"}
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y">
        {site.indicators.map((trend) => (
          <IndicatorRow key={trend.indicator} trend={trend} />
        ))}
      </ul>

      {watched.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Worth watching: {watched.map((w) => `${w.display} — ${WATCH[w.indicator].why}`).join("; ")}.
        </p>
      )}

      <p className="text-sm">
        <Link href={`/?site=${encodeURIComponent(site.siteId)}`} className="underline underline-offset-2">
          Open on the map
        </Link>
      </p>
    </section>
  );
}

export function TrendsDashboard() {
  const [days, setDays] = useState(28);
  const trends = useApi(useCallback(() => api.getTrends(days), [days]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="window">Window</Label>
          <Select
            items={WINDOWS.map((d) => ({ value: String(d), label: `Last ${d} days` }))}
            value={String(days)}
            onValueChange={(value) => value && setDays(Number(value))}
          >
            <SelectTrigger id="window" className="h-11 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {trends.data && <p className="pb-3 text-sm text-muted-foreground">{formatRange(trends.data)}</p>}
      </div>

      {trends.error && <LoadError error={trends.error} what="trends" />}
      {!trends.data && !trends.error && <LoadingRows rows={3} label="Loading trends" />}

      {trends.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={trends.data.totals.reports} label="citizen reports" />
            <Stat value={trends.data.totals.reporters} label="people reporting" />
            <Stat value={trends.data.totals.sites} label="sites watched" />
            <Stat
              value={`${trends.data.totals.answeredAlerts}/${trends.data.totals.activeAlerts}`}
              label="active alerts answered"
            />
          </div>

          <section aria-labelledby="regions-heading" className="rounded-xl border bg-card p-4 text-card-foreground">
            <h2 id="regions-heading" className="font-semibold">
              By region
            </h2>
            <div className="mt-1">
              {trends.data.regions.map((region) => (
                <RegionRow key={region.region} region={region} />
              ))}
            </div>
          </section>

          <section aria-labelledby="sites-heading" className="space-y-4">
            <h2 id="sites-heading" className="font-semibold">
              By site, worst first
            </h2>
            {trends.data.sites.map((site) => (
              <SiteCard key={site.siteId} site={site} />
            ))}
          </section>

          <p className="text-sm text-muted-foreground">
            Built from the same FHIR resources the map and the clinic screens use: every number here is a count of{" "}
            <code>Observation</code> and <code>DetectedIssue</code> resources on the public endpoint.{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org"}/trends?days=${days}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              See the raw response
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </>
      )}
    </div>
  );
}
