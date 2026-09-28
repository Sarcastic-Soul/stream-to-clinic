"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIcon,
  BatteryFullIcon,
  BellRingIcon,
  CheckIcon,
  CloudSunIcon,
  DropletsIcon,
  FileJsonIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  SignalIcon,
  WifiIcon,
} from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { AlertBanner, LiveIndicator } from "@/components/clinic/live-alerts";
import { InfoTip } from "@/components/info-tip";
import { ReportForm } from "@/components/report/report-form";
import { LoadingRows } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { useLiveAlerts, type Arrival } from "@/hooks/use-live-alerts";
import { useTranslate } from "@/hooks/use-locale";
import { api } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import type { ReportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type StepState = "idle" | "active" | "done" | "skipped";

interface Run {
  sentAt: number;
  result?: ReportResult;
  arrival?: Arrival;
}

/**
 * The One Health loop on one screen: a citizen's phone on the left, the clinic's on the right, and
 * the FHIR resources passing between them in the middle, timed from Send to the clinic's banner.
 * Below the lg breakpoint the phones drop their frames and stack: citizen, steps, clinic.
 */
export function LiveLoop({ siteId, clinicId: requestedClinic }: { siteId: string; clinicId?: string }) {
  const t = useTranslate();
  const clinics = useApi(api.getClinics);
  const clinic = clinics.data?.find((c) => c.id === requestedClinic) ?? clinics.data?.find((c) => c.siteIds.includes(siteId));
  const [run, setRun] = useState<Run | null>(null);
  const [banner, setBanner] = useState<Arrival | null>(null);
  const clinicRef = useRef<HTMLElement>(null);

  const onArrival = useCallback((arrival: Arrival) => {
    setBanner(arrival);
    setRun((current) => (current && !current.arrival ? { ...current, arrival } : current));
    // Stacked on a phone, the clinic is further down the page: bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) clinicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const live = useLiveAlerts(clinic?.id, onArrival);
  const dismiss = useCallback(() => setBanner(null), []);

  const clinicAlert = run?.result?.alerts.find((a) => a.watchFor !== "");
  const steps = useMemo(() => stepStates(run, Boolean(clinicAlert)), [run, clinicAlert]);
  const elapsed = run?.arrival ? (run.arrival.receivedAt - run.sentAt) / 1000 : undefined;
  const fired = run?.result?.alerts.length ?? 0;

  return (
    <div className="space-y-8 lg:space-y-10">
      <header className="mx-auto max-w-3xl space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          {t("loop.title")}
          <InfoTip label={t("common.moreInfo")} className="ml-2 size-6 align-[0.35em]">
            {t("loop.info")}
          </InfoTip>
        </h1>
        <p className="text-muted-foreground text-pretty sm:text-lg">
          <span className="hidden lg:inline">{t("loop.subtitle")}</span>
          <span className="lg:hidden">{t("loop.subtitleStacked")}</span>
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)_360px] lg:gap-10">
        <Phone step={1} label={t("loop.citizen")} sublabel={t("loop.citizenSub")} testId="citizen-phone">
          <div className="px-4 pt-3 pb-6 lg:px-5">
            <ReportForm
              compact
              initialSiteId={siteId}
              onSending={() => setRun({ sentAt: Date.now() })}
              onReported={(result) => setRun((current) => ({ sentAt: current?.sentAt ?? Date.now(), ...current, result }))}
            />
          </div>
        </Phone>

        <section aria-label={t("loop.steps")} className="space-y-5 lg:sticky lg:top-24 lg:pt-12">
          <div
            id="loop-timer"
            data-state={elapsed !== undefined ? "done" : run ? "running" : "idle"}
            className={cn(
              "rounded-3xl border p-6 text-center shadow-sm transition-colors duration-500",
              elapsed !== undefined
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                : "bg-card/80 backdrop-blur",
            )}
          >
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("loop.timer")}</p>
            <div className="mt-2 flex h-14 items-center justify-center font-mono text-5xl font-bold tabular-nums">
              {elapsed !== undefined ? (
                <span className="text-emerald-700 dark:text-emerald-300">{elapsed.toFixed(1)} s</span>
              ) : run && !run.result?.alerts.length && run.result ? (
                <CheckIcon className="size-10 text-emerald-600" aria-hidden />
              ) : run ? (
                <LoaderCircleIcon className="size-10 animate-spin text-sky-500" aria-hidden />
              ) : (
                <span className="text-muted-foreground/40">0.0 s</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {elapsed !== undefined
                ? t("loop.timerDone", { clinic: clinic?.name ?? t("loop.theClinic") })
                : run?.result && !clinicAlert
                  ? t("loop.timerQuiet")
                  : run
                    ? t("loop.timerRunning")
                    : t("loop.timerIdle")}
            </p>
          </div>

          <ol className="relative grid gap-2">
            <Step
              state={steps.observation}
              icon={<FileJsonIcon className="size-5" />}
              title={t("loop.step.observation")}
              resource="Observation"
              info="loop.step.observationInfo"
              href={run?.result?.fhirUrl}
              testId="step-observation"
            />
            <Step
              state={steps.engine}
              icon={<CloudSunIcon className="size-5" />}
              title={t("loop.step.engine")}
              note={
                run?.result
                  ? fired
                    ? t(fired === 1 ? "loop.step.engineFired" : "loop.step.engineFiredMany", { count: fired })
                    : t("loop.step.engineQuiet")
                  : undefined
              }
              info="loop.step.engineInfo"
              testId="step-engine"
            />
            <Step
              state={steps.issue}
              icon={<ShieldAlertIcon className="size-5" />}
              title={t("loop.step.issue")}
              resource="DetectedIssue"
              info="loop.step.issueInfo"
              href={clinicAlert?.fhir.detectedIssue}
              testId="step-issue"
            />
            <Step
              state={steps.communication}
              icon={<BellRingIcon className="size-5" />}
              title={t("loop.step.communication")}
              resource="Communication"
              info="loop.step.communicationInfo"
              href={clinicAlert?.fhir.communications[0]}
              testId="step-communication"
              last
            />
          </ol>
        </section>

        <Phone
          ref={clinicRef}
          step={2}
          label={clinic?.name ?? t("loop.clinic")}
          sublabel={clinic ? t("loop.clinicSub", { city: clinic.city }) : t("loop.loadingClinic")}
          testId="clinic-phone"
          overlay={banner && clinic ? <AlertBanner arrival={banner} clinicId={clinic.id} onDismiss={dismiss} inFrame autoHideMs={30_000} /> : null}
        >
          {clinic ? (
            <ClinicScreen clinicId={clinic.id} status={live.status} arrivals={live.arrivals} />
          ) : (
            <div className="p-4">
              <LoadingRows rows={3} label={t("loop.loadingClinic")} />
            </div>
          )}
        </Phone>
      </div>
    </div>
  );
}

function stepStates(run: Run | null, clinicFacing: boolean): Record<"observation" | "engine" | "issue" | "communication", StepState> {
  if (!run) return { observation: "idle", engine: "idle", issue: "idle", communication: "idle" };
  if (!run.result) return { observation: "active", engine: "idle", issue: "idle", communication: "idle" };
  if (!clinicFacing) return { observation: "done", engine: "done", issue: "skipped", communication: "skipped" };
  return { observation: "done", engine: "done", issue: "done", communication: run.arrival ? "done" : "active" };
}

function Step({
  state,
  icon,
  title,
  note,
  resource,
  info,
  href,
  testId,
  last = false,
}: {
  state: StepState;
  icon: ReactNode;
  title: string;
  note?: string;
  resource?: string;
  info: MessageKey;
  href?: string;
  testId: string;
  last?: boolean;
}) {
  const t = useTranslate();
  return (
    <li data-testid={testId} data-state={state} className="relative flex items-center gap-4">
      {/* The line joining this step to the next one fills in once this step is done. */}
      {!last && (
        <span
          className={cn(
            "absolute top-12 left-6 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 rounded-full transition-colors duration-500",
            state === "done" ? "bg-emerald-400" : "bg-border",
          )}
          aria-hidden
        />
      )}
      <span
        className={cn(
          "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 bg-background transition-all duration-500",
          state === "done" && "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
          state === "active" && "border-sky-500 text-sky-600 dark:text-sky-400",
          (state === "idle" || state === "skipped") && "text-muted-foreground",
        )}
      >
        {state === "active" && <span className="absolute inset-0 animate-ping rounded-2xl border-2 border-sky-400 opacity-50" aria-hidden />}
        {state === "done" ? <CheckIcon className="size-6" /> : icon}
      </span>
      <div className={cn("flex min-w-0 flex-1 items-center gap-2 py-3 transition-opacity duration-500", (state === "idle" || state === "skipped") && "opacity-50")}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        {resource &&
          (href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              title={t("loop.openRecord")}
              className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-xs font-medium text-sky-800 underline-offset-2 hover:underline dark:bg-sky-950 dark:text-sky-200"
            >
              {resource}
              <span className="sr-only"> {t("common.opensNewTab")}</span>
            </a>
          ) : (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{resource}</span>
          ))}
        <InfoTip label={t("common.moreInfo")} side="left">
          {t(info)}
        </InfoTip>
      </div>
    </li>
  );
}

// A phone on wide screens (frame, status bar, scrolling screen); a plain card when stacked.
function Phone({
  ref,
  step,
  label,
  sublabel,
  children,
  overlay,
  testId,
}: {
  ref?: React.Ref<HTMLElement>;
  step: number;
  label: string;
  sublabel: string;
  children: ReactNode;
  overlay?: ReactNode;
  testId: string;
}) {
  return (
    <figure ref={ref} className="mx-auto w-full max-w-[400px] scroll-mt-20 space-y-3 lg:max-w-[360px]">
      <figcaption className="flex items-center gap-3 px-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm">{step}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{label}</span>
          <span className="block truncate text-sm text-muted-foreground">{sublabel}</span>
        </span>
      </figcaption>
      <div className="lg:rounded-[3rem] lg:bg-gradient-to-b lg:from-slate-600 lg:to-slate-900 lg:p-2.5 lg:shadow-2xl lg:ring-1 lg:shadow-sky-950/30 lg:ring-black/20">
        <div
          data-testid={testId}
          className="relative isolate overflow-hidden rounded-3xl border bg-background shadow-sm lg:h-[720px] lg:rounded-[2.4rem] lg:border-0 lg:shadow-none"
        >
          <StatusBar />
          {overlay && <div className="absolute inset-x-0 top-1 z-50 lg:top-10">{overlay}</div>}
          <div className="no-scrollbar lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pt-10">{children}</div>
        </div>
      </div>
    </figure>
  );
}

function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden h-10 items-center justify-between bg-background/85 px-7 text-xs font-semibold backdrop-blur lg:flex" aria-hidden>
      <span>9:41</span>
      <span className="absolute top-2 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
      <span className="flex items-center gap-1">
        <SignalIcon className="size-3.5" />
        <WifiIcon className="size-3.5" />
        <BatteryFullIcon className="size-4" />
      </span>
    </div>
  );
}

function ClinicScreen({ clinicId, status, arrivals }: { clinicId: string; status: ReturnType<typeof useLiveAlerts>["status"]; arrivals: Arrival[] }) {
  const t = useTranslate();
  const load = useMemo(() => () => api.getAlerts({ clinicId }), [clinicId]);
  const alerts = useApi(load);
  const fresh = new Set(arrivals.map((a) => a.alert.id));
  const list = alerts.data && [...arrivals.map((a) => a.alert), ...alerts.data.filter((a) => !fresh.has(a.id))];

  return (
    <div className="space-y-3 px-4 pt-3 pb-6 lg:px-5">
      <div className="flex items-center gap-2">
        <ActivityIcon className="size-5 text-sky-600 dark:text-sky-400" aria-hidden />
        <h2 className="text-lg font-semibold">{t("loop.clinicTitle")}</h2>
        <LiveIndicator status={status} className="ml-auto" />
      </div>
      {alerts.loading && <LoadingRows rows={2} label={t("loop.loadingAlerts")} />}
      {list?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          <DropletsIcon className="size-8 text-sky-400" aria-hidden />
          {t("loop.noAlerts")}
        </div>
      )}
      <ul className="space-y-2" id="clinic-alert-list">
        {list?.map((alert) => (
          <li
            key={alert.id}
            data-new={fresh.has(alert.id) || undefined}
            className="rounded-xl data-new:animate-in data-new:fade-in data-new:slide-in-from-top-4 data-new:ring-2 data-new:ring-sky-400 data-new:duration-700"
          >
            <AlertCard alert={alert} clinicId={clinicId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
