"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, ExternalLinkIcon } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkline } from "@/components/trends/sparkline";
import { useApi } from "@/hooks/use-api";
import { useLocale, useTranslate } from "@/hooks/use-locale";
import { api } from "@/lib/api";
import { alertTitle, indicatorLabel } from "@/lib/format";
import type { Locale, Translate } from "@/lib/i18n";
import type { IndicatorTrend, RegionTrend, RiskKind, SiteTrend, Trends } from "@/lib/types";

const WINDOWS = [14, 28, 90];

// Which way a reading has to move before it is worth a clinician's attention. The rules behind the
// alerts use absolute thresholds; this is the same idea one step earlier — a stream drifting
// towards a threshold, before it crosses one. The reason for each is a message key.
const WATCH: Record<string, { direction: "rising" | "falling"; why: Parameters<Translate>[0] }> = {
  waterTemperature: { direction: "rising", why: "trends.why.waterTemperature" },
  dissolvedO2: { direction: "falling", why: "trends.why.dissolvedO2" },
  conductivity: { direction: "rising", why: "trends.why.conductivity" },
};

const ARROW = {
  rising: ArrowUpRightIcon,
  falling: ArrowDownRightIcon,
  steady: ArrowRightIcon,
} as const;

// The trends response names an alert only by its English title, so the kind is looked up from it
// to show the translated name. Mirrors RISKS in api/src/rules.ts; an unknown title stays as sent.
const KIND_BY_TITLE: Record<string, RiskKind> = {
  "Possible algal bloom": "algal-bloom",
  "Possible sewage overflow": "sewage-overflow",
  "Mosquito breeding conditions": "mosquito-breeding",
  "Low dissolved oxygen": "low-oxygen",
};

function trendAlertTitle(t: Translate, title: string): string {
  const risk = KIND_BY_TITLE[title];
  return risk ? alertTitle(t, { risk, title }) : title;
}

const nameOf = (t: Translate, trend: IndicatorTrend) => indicatorLabel(t, { id: trend.indicator, display: trend.display });

function formatRange(trends: Trends, locale: Locale): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
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
  const t = useTranslate();
  const parts = [
    region.sites === 1 ? t("trends.sitesOne") : t("trends.sitesMany", { count: region.sites }),
    region.reports === 1 ? t("trends.reportsOne") : t("trends.reportsMany", { count: region.reports }),
    region.sitesAtRisk === 0 ? t("trends.noneAtRisk") : t("trends.atRisk", { count: region.sitesAtRisk }),
  ];
  if (region.activeAlerts > 0) parts.push(t("trends.answered", { answered: region.answeredAlerts, total: region.activeAlerts }));
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
      <p className="font-medium">{region.region}</p>
      <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
    </div>
  );
}

function IndicatorRow({ trend }: { trend: IndicatorTrend }) {
  const t = useTranslate();
  const watch = WATCH[trend.indicator];
  const notable = watch?.direction === trend.direction;
  const Arrow = ARROW[trend.direction];
  const unit = trend.unitLabel && trend.unitLabel !== "pH" ? ` ${trend.unitLabel}` : "";
  const days = trend.points.filter((p) => p.value > 0).length;

  let detail: string;
  if (trend.kind === "quantity" && trend.earlier !== undefined && trend.recent !== undefined) {
    detail = t("trends.change", { earlier: `${trend.earlier}${unit}`, recent: `${trend.recent}${unit}` });
  } else if (trend.kind === "presence") {
    detail =
      days === 0
        ? trend.reports === 1
          ? t("trends.neverSeenOne")
          : t("trends.neverSeenMany", { count: trend.reports })
        : trend.points.length === 1
          ? t("trends.seenOne")
          : t("trends.seen", { days, total: trend.points.length });
  } else {
    detail = trend.reports === 1 ? t("trends.readingsOne") : t("trends.readingsMany", { count: trend.reports });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
        <p className="text-sm font-medium">{nameOf(t, trend)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{detail}</p>
      </div>
      <Sparkline points={trend.points} color={notable ? "#d97706" : "#64748b"} />
      <p
        className={`ml-auto inline-flex w-28 shrink-0 items-center justify-end gap-1 text-sm ${
          notable ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"
        }`}
      >
        <Arrow className="size-4" aria-hidden />
        {t(`trends.dir.${trend.direction}`)}
      </p>
    </li>
  );
}

function SiteCard({ site }: { site: SiteTrend }) {
  const t = useTranslate();
  const watched = site.indicators.filter((i) => WATCH[i.indicator]?.direction === i.direction);
  const baseline = site.health[0];
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

      <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {site.reports === 1 ? t("trends.reportsOne") : t("trends.reportsMany", { count: site.reports })} ·{" "}
          {site.reporters === 1 ? t("trends.reportersOne") : t("trends.reportersMany", { count: site.reporters })}
        </span>
        {baseline && (
          <>
            <span className="tabular-nums">
              · {t("trends.baseline", { value: baseline.value, unit: baseline.unit, period: baseline.period })}
            </span>
            <InfoTip label={t("common.moreInfo")}>{t("trends.baselineInfo")}</InfoTip>
          </>
        )}
      </p>

      {site.activeAlerts.length > 0 && (
        <ul className="space-y-1">
          {site.activeAlerts.map((alert) => (
            <li key={alert.id} className="text-sm">
              <Link href={`/alerts/${encodeURIComponent(alert.id)}`} className="underline underline-offset-2">
                {trendAlertTitle(t, alert.title)}
              </Link>
              <span className="text-muted-foreground"> · {alert.answered ? t("common.answered") : t("trends.awaiting")}</span>
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
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <p>{t("trends.watch", { indicators: watched.map((w) => nameOf(t, w)).join(", ") })}</p>
          <InfoTip label={t("common.moreInfo")} className="text-amber-800 dark:text-amber-300">
            <ul className="space-y-1">
              {watched.map((w) => (
                <li key={w.indicator}>
                  <span className="font-medium">{nameOf(t, w)}:</span> {t(WATCH[w.indicator].why)}
                </li>
              ))}
            </ul>
          </InfoTip>
        </div>
      )}

      <p className="text-sm">
        <Link href={`/?site=${encodeURIComponent(site.siteId)}`} className="underline underline-offset-2">
          {t("trends.openMap")}
        </Link>
      </p>
    </section>
  );
}

export function TrendsDashboard() {
  const t = useTranslate();
  const locale = useLocale();
  const [days, setDays] = useState(28);
  const trends = useApi(useCallback(() => api.getTrends(days), [days]));
  const windowLabel = (d: number) => t("trends.lastDays", { days: d });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold">{t("trends.title")}</h1>
          <InfoTip label={t("common.moreInfo")}>{t("trends.info")}</InfoTip>
        </div>
        <p className="text-muted-foreground">{t("trends.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="window">{t("trends.period")}</Label>
          <Select
            items={WINDOWS.map((d) => ({ value: String(d), label: windowLabel(d) }))}
            value={String(days)}
            onValueChange={(value) => value && setDays(Number(value))}
          >
            <SelectTrigger id="window" className="h-11 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {windowLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {trends.data && <p className="pb-3 text-sm text-muted-foreground">{formatRange(trends.data, locale)}</p>}
      </div>

      {trends.error && <LoadError error={trends.error} what="trends" />}
      {!trends.data && !trends.error && <LoadingRows rows={3} label={t("trends.loading")} />}

      {trends.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={trends.data.totals.reports} label={t("trends.stat.reports")} />
            <Stat value={trends.data.totals.reporters} label={t("trends.stat.reporters")} />
            <Stat value={trends.data.totals.sites} label={t("trends.stat.sites")} />
            <Stat
              value={`${trends.data.totals.answeredAlerts}/${trends.data.totals.activeAlerts}`}
              label={t("trends.stat.answered")}
            />
          </div>

          <section aria-labelledby="regions-heading" className="rounded-xl border bg-card p-4 text-card-foreground">
            <h2 id="regions-heading" className="font-semibold">
              {t("trends.byRegion")}
            </h2>
            <div className="mt-1">
              {trends.data.regions.map((region) => (
                <RegionRow key={region.region} region={region} />
              ))}
            </div>
          </section>

          <section aria-labelledby="sites-heading" className="space-y-4">
            <h2 id="sites-heading" className="font-semibold">
              {t("trends.bySite")}
            </h2>
            {trends.data.sites.map((site) => (
              <SiteCard key={site.siteId} site={site} />
            ))}
          </section>

          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org"}/trends?days=${days}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              {t("trends.rawData")}
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">{t("common.opensNewTab")}</span>
            </a>
            <InfoTip label={t("common.moreInfo")}>{t("trends.sourceInfo")}</InfoTip>
          </p>
        </>
      )}
    </div>
  );
}
