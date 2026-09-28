"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BellRingIcon,
  BotIcon,
  CircleCheckIcon,
  CloudSunIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  HourglassIcon,
  LeafIcon,
  MessageSquareReplyIcon,
  SendIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { LoadError, LoadingRows, RiskBadge } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { useTranslate } from "@/hooks/use-locale";
import { api } from "@/lib/api";
import { formatDateTime, formatValue, indicatorLabel, presenceLabel } from "@/lib/format";
import type { Indicator, JourneyAlert, ReportJourney } from "@/lib/types";
import { cn } from "@/lib/utils";

// Clinic replies can come in at any time; the page checks again while it is open and visible.
const REFRESH_MS = 15_000;

type Tone = "done" | "waiting" | "quiet";

interface Step {
  key: string;
  kind: string;
  icon: ReactNode;
  tone: Tone;
  title: string;
  at?: string;
  detail?: ReactNode;
  links?: { label: string; href: string }[];
}

const resourceLabel = (url: string) => url.split("/").slice(-2).join("/");

export function ReportJourneyView({ id }: { id: string }) {
  const t = useTranslate();
  const [journey, setJourney] = useState<{ id: string; data?: ReportJourney; error?: Error }>({ id });
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  useEffect(() => {
    api.getIndicators().then(setIndicators, () => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () =>
      api.getReportJourney(id).then(
        (data) => active && setJourney({ id, data }),
        // A failed refresh keeps what is already on screen.
        (error: Error) => active && setJourney((prev) => (prev.id === id && prev.data ? prev : { id, error })),
      );
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  const current = journey.id === id ? journey : { id };
  if (current.error) return <LoadError error={current.error} what="this report" />;
  if (!current.data) return <LoadingRows rows={5} label={t("journey.loading")} />;

  const { report, site, alerts, provenance } = current.data;
  const reportedAt = provenance?.recorded ?? report.observedAt;
  const indicator = indicators.find((i) => i.id === report.indicator);
  const name = indicator ? indicatorLabel(t, indicator) : report.indicator;
  const value = typeof report.value === "string" ? presenceLabel(t, report.value) : formatValue(report, indicator);

  return (
    <div className="space-y-8" data-testid="journey">
      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-6 dark:from-sky-950/60 dark:via-cyan-950/40 dark:to-emerald-950/40">
        <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/20" aria-hidden />
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase dark:text-sky-300">{t("journey.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t("journey.title")}</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">{t("journey.intro")}</p>
        <div className="mt-5 flex items-center gap-4 rounded-2xl border bg-background/70 p-4 backdrop-blur">
          {report.photoUrl ? (
            <Image
              src={report.photoUrl}
              alt={t("report.photoAlt")}
              width={72}
              height={72}
              unoptimized
              crossOrigin="anonymous"
              className="size-18 shrink-0 rounded-xl border object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow">
              <SendIcon className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold" data-testid="journey-reading">
              {name}: {value}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {site.name}
              {site.waterBody ? ` · ${site.waterBody}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {report.reporter} · <time dateTime={report.observedAt}>{formatDateTime(report.observedAt)}</time>
            </p>
          </div>
        </div>
      </header>

      <Timeline steps={reportSteps(t, current.data, name, value)} />

      {alerts.map((alert) => (
        <section key={alert.id} className="space-y-4" data-testid="journey-alert" aria-labelledby={`alert-${alert.id}`}>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4">
            <ShieldAlertIcon className="size-5 text-orange-600 dark:text-orange-400" aria-hidden />
            <h2 id={`alert-${alert.id}`} className="font-semibold">
              {alert.title}
            </h2>
            <RiskBadge level={alert.level} className={cn(alert.status === "closed" && "opacity-60 grayscale")} />
            <Link href={`/alerts/${encodeURIComponent(alert.id)}`} className="ml-auto text-sm font-medium underline underline-offset-2">
              {resourceLabel(alert.fhir.detectedIssue)}
            </Link>
          </div>
          <Timeline steps={alertSteps(t, alert, reportedAt)} />
        </section>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/report?site=${encodeURIComponent(site.id)}`} className={buttonVariants({ size: "lg", className: "h-11 sm:flex-1" })}>
          {t("journey.reportAnother")}
        </Link>
        <Link href={`/?site=${encodeURIComponent(site.id)}`} className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 sm:flex-1" })}>
          {t("report.seeOnMap")}
        </Link>
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslate>;

function reportSteps(t: T, journey: ReportJourney, name: string, value: string): Step[] {
  const { report, provenance, alerts, fhirUrl } = journey;
  return [
    {
      key: "sent",
      kind: "sent",
      icon: <SendIcon className="size-4" />,
      tone: "done",
      title: t("journey.sent"),
      at: report.observedAt,
      detail: `${name}: ${value} · ${journey.site.name}`,
    },
    {
      key: "stored",
      kind: "stored",
      icon: <DatabaseIcon className="size-4" />,
      tone: "done",
      title: t("journey.stored"),
      at: provenance?.recorded,
      detail: t("journey.storedDetail"),
      links: [
        { label: resourceLabel(fhirUrl), href: fhirUrl },
        ...(provenance ? [{ label: resourceLabel(provenance.fhirUrl), href: provenance.fhirUrl }] : []),
      ],
    },
    {
      key: "checked",
      kind: "checked",
      icon: <CloudSunIcon className="size-4" />,
      tone: alerts.length ? "done" : "quiet",
      title: t("journey.checked"),
      detail: alerts.length === 0 ? t("journey.quiet") : alerts.length === 1 ? t("journey.citedOne") : t("journey.citedMany", { count: alerts.length }),
    },
  ];
}

// `reportedAt` separates what the report caused from what was already under way when it arrived:
// a report can strengthen an alert that another report raised earlier.
function alertSteps(t: T, alert: JourneyAlert, reportedAt: string): Step[] {
  const replies = alert.acknowledgements ?? [];
  const before = (at: string) => at < reportedAt;
  const steps: Step[] = [
    {
      key: "raised",
      kind: "raised",
      icon: <ShieldAlertIcon className="size-4" />,
      tone: "done",
      title: before(alert.createdAt) ? t("journey.joined") : t("journey.raised"),
      at: alert.createdAt,
      detail: alert.reasons.join(" "),
      links: [{ label: resourceLabel(alert.fhir.detectedIssue), href: alert.fhir.detectedIssue }],
    },
    ...alert.notified.map(
      (n): Step => ({
        key: `notified-${n.clinicId}`,
        kind: "notified",
        icon: <BellRingIcon className="size-4" />,
        tone: "done",
        title: before(n.at) ? t("journey.alreadyTold", { clinic: n.clinicName }) : t("journey.notified", { clinic: n.clinicName }),
        at: n.at,
        detail: alert.watchFor ? `Watch for: ${alert.watchFor}` : undefined,
        links: [{ label: resourceLabel(n.fhirUrl), href: n.fhirUrl }],
      }),
    ),
    ...(alert.notified.length === 0
      ? [{ key: "environmental", kind: "environmental", icon: <LeafIcon className="size-4" />, tone: "quiet" as const, title: t("journey.environmental") }]
      : []),
    ...(alert.advisory
      ? [
          {
            key: "advisory",
            kind: "advisory",
            icon: <BotIcon className="size-4" />,
            tone: "done" as const,
            title: t("journey.advisory"),
            at: alert.advisory.generatedAt,
            detail: alert.advisory.model,
            links: [{ label: resourceLabel(alert.advisory.fhirUrl), href: alert.advisory.fhirUrl }],
          },
        ]
      : []),
    ...replies.map(
      (r): Step => ({
        key: `reply-${r.id}`,
        kind: "replied",
        icon: <MessageSquareReplyIcon className="size-4" />,
        tone: "done",
        title: t("journey.replied", { clinic: r.clinicName }),
        at: r.at,
        detail: r.note && r.note !== r.actionLabel ? `${r.actionLabel}: “${r.note}”` : r.actionLabel,
        links: [{ label: resourceLabel(r.fhirUrl), href: r.fhirUrl }],
      }),
    ),
    ...(alert.closedAt
      ? [{ key: "closed", kind: "closed", icon: <CircleCheckIcon className="size-4" />, tone: "done" as const, title: t("journey.closed"), at: alert.closedAt }]
      : []),
  ];
  const ordered = steps.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : 0));
  if (alert.notified.length && replies.length === 0 && alert.status === "active") {
    ordered.push({
      key: "waiting",
      kind: "waiting",
      icon: <HourglassIcon className="size-4" />,
      tone: "waiting",
      title: t("journey.waiting"),
      detail: t("journey.waitingDetail"),
    });
  }
  return ordered;
}

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-4 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-sky-400 before:via-cyan-400 before:to-emerald-400">
      {steps.map((step, i) => (
        <li
          key={step.key}
          data-testid="journey-step"
          data-kind={step.kind}
          data-tone={step.tone}
          className="relative flex gap-4 animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <span
            className={cn(
              "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-background",
              step.tone === "done" && "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
              step.tone === "waiting" && "border-sky-500 text-sky-600 dark:text-sky-400",
              step.tone === "quiet" && "text-muted-foreground",
            )}
          >
            {step.tone === "waiting" && <span className="absolute inset-0 animate-ping rounded-full border-2 border-sky-400 opacity-50" aria-hidden />}
            {step.icon}
          </span>
          <div className={cn("min-w-0 flex-1 rounded-2xl border bg-card p-4 shadow-sm", step.tone === "quiet" && "bg-muted/40 shadow-none")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold">{step.title}</p>
              {step.at && (
                <time dateTime={step.at} className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(step.at)}
                </time>
              )}
            </div>
            {step.detail && <p className="mt-1 text-sm text-pretty text-muted-foreground">{step.detail}</p>}
            {step.links?.length ? (
              <p className="mt-2 flex flex-wrap gap-2">
                {step.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 font-mono text-xs hover:border-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                  >
                    {link.label}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ))}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
