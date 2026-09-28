"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIcon,
  BellRingIcon,
  CheckIcon,
  CloudSunIcon,
  FileJsonIcon,
  HospitalIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  SmartphoneIcon,
} from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { AlertBanner, LiveIndicator } from "@/components/clinic/live-alerts";
import { ReportForm } from "@/components/report/report-form";
import { LoadingRows } from "@/components/status";
import { useApi } from "@/hooks/use-api";
import { useLiveAlerts, type Arrival } from "@/hooks/use-live-alerts";
import { api } from "@/lib/api";
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
 */
export function LiveLoop({ siteId, clinicId: requestedClinic }: { siteId: string; clinicId?: string }) {
  const clinics = useApi(api.getClinics);
  const clinic = clinics.data?.find((c) => c.id === requestedClinic) ?? clinics.data?.find((c) => c.siteIds.includes(siteId));
  const [run, setRun] = useState<Run | null>(null);
  const [banner, setBanner] = useState<Arrival | null>(null);

  const onArrival = useCallback((arrival: Arrival) => {
    setBanner(arrival);
    setRun((current) => (current && !current.arrival ? { ...current, arrival } : current));
  }, []);
  const live = useLiveAlerts(clinic?.id, onArrival);
  const dismiss = useCallback(() => setBanner(null), []);

  const clinicAlert = run?.result?.alerts.find((a) => a.watchFor !== "");
  const steps = useMemo(() => stepStates(run, Boolean(clinicAlert)), [run, clinicAlert]);
  const elapsed = run?.arrival ? (run.arrival.receivedAt - run.sentAt) / 1000 : undefined;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,380px)] lg:gap-8">
      <Phone label="Citizen scientist" sublabel="Reporting from the stream bank" icon={<SmartphoneIcon className="size-4" aria-hidden />} testId="citizen-phone">
        <div className="px-4 pt-4 pb-8">
          <h2 className="mb-4 text-lg font-semibold">Report what you see</h2>
          <ReportForm
            initialSiteId={siteId}
            onSending={() => setRun({ sentAt: Date.now() })}
            onReported={(result) => setRun((current) => ({ sentAt: current?.sentAt ?? Date.now(), ...current, result }))}
          />
        </div>
      </Phone>

      <section aria-label="What happens in between" className="order-last space-y-4 lg:order-none lg:pt-16">
        <div
          id="loop-timer"
          data-state={elapsed !== undefined ? "done" : run ? "running" : "idle"}
          className={cn(
            "rounded-2xl border p-5 text-center transition-colors duration-500",
            elapsed !== undefined ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "bg-card",
          )}
        >
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Report to clinic</p>
          <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">
            {elapsed !== undefined ? `${elapsed.toFixed(1)} s` : run ? <LoaderCircleIcon className="mx-auto size-9 animate-spin text-sky-500" /> : "–"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {elapsed !== undefined
              ? `${clinic?.name ?? "The clinic"} was warned before the citizen put the phone away.`
              : run?.result && !clinicAlert
                ? "Stored as FHIR. No clinic-facing rule fired for this reading."
                : "Send a report on the left and watch the clinic's phone."}
          </p>
        </div>

        <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[1.35rem] before:w-px before:bg-border">
          <Step
            state={steps.observation}
            icon={<FileJsonIcon className="size-4" />}
            title="Observation"
            detail="ObservationIndicatorsOah, OAH IG profile, with Provenance"
            href={run?.result?.fhirUrl}
            testId="step-observation"
          />
          <Step
            state={steps.engine}
            icon={<CloudSunIcon className="size-4" />}
            title="Risk engine"
            detail={
              run?.result
                ? run.result.alerts.length
                  ? `${run.result.alerts.length === 1 ? "A rule fired" : `${run.result.alerts.length} rules fired`}: ${run.result.alerts.map((a) => a.title).join(", ")}`
                  : "Every rule checked; none fired"
                : "Recent reports + live Open-Meteo weather, every step explained"
            }
            testId="step-engine"
          />
          <Step
            state={steps.issue}
            icon={<ShieldAlertIcon className="size-4" />}
            title="DetectedIssue"
            detail="The alert, citing the Observations as evidence"
            href={clinicAlert?.fhir.detectedIssue}
            testId="step-issue"
          />
          <Step
            state={steps.communication}
            icon={<BellRingIcon className="size-4" />}
            title="Communication → clinic"
            detail="Sent to every clinic serving the stream, delivered live to its open app"
            href={clinicAlert?.fhir.communications[0]}
            testId="step-communication"
          />
        </ol>
      </section>

      <Phone
        label={clinic?.name ?? "Clinic"}
        sublabel={clinic ? `Primary care · ${clinic.city}` : "Loading"}
        icon={<HospitalIcon className="size-4" aria-hidden />}
        testId="clinic-phone"
        overlay={banner && clinic ? <AlertBanner arrival={banner} clinicId={clinic.id} onDismiss={dismiss} inFrame autoHideMs={30_000} /> : null}
      >
        {clinic ? <ClinicScreen clinicId={clinic.id} status={live.status} arrivals={live.arrivals} /> : <div className="p-4"><LoadingRows rows={3} label="Loading clinic" /></div>}
      </Phone>
    </div>
  );
}

function stepStates(run: Run | null, clinicFacing: boolean): Record<"observation" | "engine" | "issue" | "communication", StepState> {
  if (!run) return { observation: "idle", engine: "idle", issue: "idle", communication: "idle" };
  if (!run.result) return { observation: "active", engine: "idle", issue: "idle", communication: "idle" };
  if (!clinicFacing) return { observation: "done", engine: "done", issue: "skipped", communication: "skipped" };
  return { observation: "done", engine: "done", issue: "done", communication: run.arrival ? "done" : "active" };
}

function Step({ state, icon, title, detail, href, testId }: { state: StepState; icon: ReactNode; title: string; detail: string; href?: string; testId: string }) {
  return (
    <li data-testid={testId} data-state={state} className="relative flex gap-3">
      <span
        className={cn(
          "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 bg-background transition-all duration-500",
          state === "done" && "border-emerald-500 bg-emerald-500 text-white",
          state === "active" && "border-sky-500 text-sky-600 dark:text-sky-400",
          (state === "idle" || state === "skipped") && "text-muted-foreground",
        )}
      >
        {state === "active" && <span className="absolute inset-0 animate-ping rounded-full border-2 border-sky-400 opacity-50" aria-hidden />}
        {state === "done" ? <CheckIcon className="size-5" /> : icon}
      </span>
      <div className={cn("min-w-0 flex-1 rounded-xl border bg-card px-3 py-2 transition-opacity duration-500", state === "idle" || state === "skipped" ? "opacity-55" : "opacity-100")}>
        <p className="font-mono text-sm font-semibold">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-sky-700 dark:hover:text-sky-300">
              {title}
            </a>
          ) : (
            title
          )}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

function Phone({
  label,
  sublabel,
  icon,
  children,
  overlay,
  testId,
}: {
  label: string;
  sublabel: string;
  icon: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  testId: string;
}) {
  return (
    <figure className="mx-auto w-full max-w-[380px] space-y-3">
      <figcaption className="flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{sublabel}</span>
        </span>
      </figcaption>
      <div className="rounded-[2.9rem] bg-gradient-to-b from-slate-700 to-slate-900 p-2.5 shadow-2xl shadow-sky-950/25 ring-1 ring-black/10">
        <div data-testid={testId} className="relative isolate h-[700px] overflow-hidden rounded-[2.3rem] bg-background">
          <div className="pointer-events-none absolute top-2 left-1/2 z-40 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-900" aria-hidden />
          {overlay && <div className="absolute inset-x-0 top-8 z-50">{overlay}</div>}
          <div className="h-full overflow-y-auto overscroll-contain pt-9">{children}</div>
        </div>
      </div>
    </figure>
  );
}

function ClinicScreen({ clinicId, status, arrivals }: { clinicId: string; status: ReturnType<typeof useLiveAlerts>["status"]; arrivals: Arrival[] }) {
  const load = useMemo(() => () => api.getAlerts({ clinicId }), [clinicId]);
  const alerts = useApi(load);
  const fresh = new Set(arrivals.map((a) => a.alert.id));
  const list = alerts.data && [...arrivals.map((a) => a.alert), ...alerts.data.filter((a) => !fresh.has(a.id))];

  return (
    <div className="space-y-3 px-4 pt-2 pb-8">
      <div className="flex items-center gap-2">
        <ActivityIcon className="size-4 text-sky-600 dark:text-sky-400" aria-hidden />
        <h2 className="font-semibold">Clinic alerts</h2>
        <LiveIndicator status={status} className="ml-auto" />
      </div>
      {alerts.loading && <LoadingRows rows={2} label="Loading alerts" />}
      {list?.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active alerts. New ones appear here on their own.</p>}
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
