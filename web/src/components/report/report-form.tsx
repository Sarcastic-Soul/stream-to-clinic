"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleAlertIcon, CircleCheckIcon, CloudOffIcon, LoaderCircleIcon, LocateFixedIcon } from "lucide-react";
import { ChoiceGroup } from "@/components/choice-group";
import { LoadError, LoadingRows } from "@/components/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { distanceKm, unitLabel } from "@/lib/format";
import { QUEUE_EVENT, enqueueReport, isNetworkError, listQueued, type QueuedReport } from "@/lib/report-queue";
import { readStored, writeStored } from "@/lib/storage";
import type { Presence, ReportInput, ReportResult, SiteSummary } from "@/lib/types";
import { PhotoField } from "./photo-field";
import { ReportSuccess } from "./report-success";

const REPORTER_KEY = "stream-to-clinic.reporter";

// Prefill the name remembered from the last report, without overwriting what the user typed.
function prefillReporter(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = readStored(REPORTER_KEY) ?? "";
}

const PRESENCE_OPTIONS: { value: Presence; label: string }[] = [
  { value: "absent", label: "Absent" },
  { value: "present", label: "Present" },
  { value: "abundant", label: "Abundant" },
];

type Locate = { state: "idle" } | { state: "locating" } | { state: "error"; message: string } | { state: "found"; km: number };

export function ReportForm({ initialSiteId }: { initialSiteId?: string }) {
  const sites = useApi(api.getSites);
  const indicators = useApi(api.getIndicators);

  const [siteId, setSiteId] = useState<string | null>(initialSiteId ?? null);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [presence, setPresence] = useState<Presence | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [locate, setLocate] = useState<Locate>({ state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ report: ReportResult; site: SiteSummary } | null>(null);
  const [queued, setQueued] = useState<QueuedReport | null>(null);
  const [queuedSent, setQueuedSent] = useState(false);

  // A queued report leaves the queue once the banner has sent it.
  useEffect(() => {
    if (!queued) return;
    const check = () => listQueued().then((items) => setQueuedSent(!items.some((item) => item.id === queued.id)));
    window.addEventListener(QUEUE_EVENT, check);
    return () => window.removeEventListener(QUEUE_EVENT, check);
  }, [queued]);

  const site = sites.data?.find((s) => s.id === siteId);
  const indicator = indicators.data?.find((i) => i.id === indicatorId);

  function chooseIndicator(id: string) {
    setIndicatorId(id);
    setQuantity("");
    setPresence(null);
  }

  function findNearest() {
    if (!("geolocation" in navigator)) {
      setLocate({ state: "error", message: "Location is not available in this browser." });
      return;
    }
    setLocate({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lon: coords.longitude };
        const nearest = (sites.data ?? [])
          .map((s) => ({ site: s, km: distanceKm(here, s) }))
          .sort((a, b) => a.km - b.km)[0];
        if (!nearest) return setLocate({ state: "error", message: "No sites to choose from yet." });
        setSiteId(nearest.site.id);
        setLocate({ state: "found", km: nearest.km });
      },
      (err) =>
        setLocate({
          state: "error",
          message: err.code === err.PERMISSION_DENIED ? "Location permission was denied. Pick a site from the list." : "Could not find your location. Pick a site from the list.",
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const reporter = String(form.get("reporter") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    if (!site) return setError("Choose a site.");
    if (!indicator) return setError("Choose what you observed.");
    let value: number | Presence;
    if (indicator.kind === "quantity") {
      value = Number(quantity);
      if (quantity.trim() === "" || !Number.isFinite(value)) return setError(`Enter a number for ${indicator.display.toLowerCase()}.`);
      if ((indicator.min !== undefined && value < indicator.min) || (indicator.max !== undefined && value > indicator.max)) {
        return setError(`${indicator.display} must be between ${indicator.min} and ${indicator.max}${unitLabel(indicator) && ` ${unitLabel(indicator)}`}.`);
      }
    } else {
      if (!presence) return setError(`Choose whether ${indicator.display.toLowerCase()} is absent, present or abundant.`);
      value = presence;
    }
    if (!reporter) return setError("Enter your name so others know who reported this.");

    const input: ReportInput = {
      siteId: site.id,
      indicator: indicator.id,
      value,
      observedAt: new Date().toISOString(),
      reporter,
      ...(note && { note }),
      ...(photo && { photo }),
    };
    // Without a connection the report waits on the device and is sent later (see ReportQueueBanner).
    const queue = async () => {
      try {
        setQueued(await enqueueReport({ input, siteName: site.name, indicatorDisplay: indicator.display }));
      } catch {
        setError("You appear to be offline, and this browser cannot store the report for later. Try again when you are back online.");
      }
    };

    setSubmitting(true);
    writeStored(REPORTER_KEY, reporter);
    try {
      if (!navigator.onLine) await queue();
      else setResult({ report: await api.createReport(input), site });
    } catch (err) {
      if (isNetworkError(err)) await queue();
      else setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reportAnother() {
    setResult(null);
    setQueued(null);
    setQueuedSent(false);
    setQuantity("");
    setPresence(null);
    setPhoto(null);
  }

  if (queued) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 ref={(el) => el?.focus()} tabIndex={-1} className="flex items-center gap-2 text-xl font-semibold outline-none">
            {queuedSent ? (
              <CircleCheckIcon className="size-6 text-green-600 dark:text-green-400" aria-hidden />
            ) : (
              <CloudOffIcon className="size-6 text-amber-600 dark:text-amber-400" aria-hidden />
            )}
            {queuedSent ? "Queued report sent" : "Queued, will send when online"}
          </h2>
          <p className="text-muted-foreground">
            {queuedSent
              ? `Your ${queued.indicatorDisplay.toLowerCase()} report for ${queued.siteName} has reached the server. See the banner above for its FHIR record.`
              : `Your ${queued.indicatorDisplay.toLowerCase()} report for ${queued.siteName} is saved on this device. It will be sent automatically when you are back online, as long as this app is open.`}
          </p>
        </div>
        <Button size="lg" className="h-11 w-full" onClick={reportAnother}>
          Report another
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <ReportSuccess
        report={result.report}
        site={result.site}
        indicator={indicators.data?.find((i) => i.id === result.report.observation.indicator)}
        onReportAnother={reportAnother}
      />
    );
  }

  if (sites.error || indicators.error) return <LoadError error={(sites.error ?? indicators.error)!} what="the report form" />;
  if (!sites.data || !indicators.data) return <LoadingRows rows={4} label="Loading report form" />;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="site">Site</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            items={sites.data.map((s) => ({ value: s.id, label: `${s.name} · ${s.waterBody}` }))}
            value={site ? site.id : null}
            onValueChange={(value) => {
              setSiteId(value);
              setLocate({ state: "idle" });
            }}
          >
            <SelectTrigger id="site" className="h-11 w-full sm:flex-1">
              <SelectValue placeholder="Choose a site" />
            </SelectTrigger>
            <SelectContent>
              {sites.data.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.waterBody}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="h-11" onClick={findNearest} disabled={locate.state === "locating"}>
            {locate.state === "locating" ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <LocateFixedIcon data-icon="inline-start" />
            )}
            Nearest to me
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {locate.state === "found" && site && `Nearest site: ${site.name}, ${locate.km.toFixed(1)} km away.`}
          {locate.state === "error" && locate.message}
          {locate.state !== "found" && locate.state !== "error" && site && site.region}
        </p>
      </div>

      <ChoiceGroup
        legend="What did you observe?"
        name="indicator"
        options={indicators.data.map((i) => ({
          value: i.id,
          label: i.display,
          hint: i.kind === "presence" ? "Seen by eye" : unitLabel(i) ? `Measured in ${unitLabel(i)}` : "Measured",
        }))}
        value={indicatorId}
        onChange={chooseIndicator}
      />

      {indicator?.kind === "quantity" && (
        <div className="space-y-2">
          <Label htmlFor="value">{indicator.display}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="value"
              type="number"
              inputMode="decimal"
              step="any"
              min={indicator.min}
              max={indicator.max}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-describedby="value-hint"
              className="h-11 text-base"
              autoFocus
            />
            {unitLabel(indicator) && <span className="min-w-12 text-sm text-muted-foreground">{unitLabel(indicator)}</span>}
          </div>
          {indicator.min !== undefined && indicator.max !== undefined && (
            <p id="value-hint" className="text-sm text-muted-foreground">
              Between {indicator.min} and {indicator.max}{unitLabel(indicator) && ` ${unitLabel(indicator)}`}.
            </p>
          )}
        </div>
      )}

      {indicator?.kind === "presence" && (
        <ChoiceGroup
          legend={`How much ${indicator.display.toLowerCase()}?`}
          name="presence"
          options={PRESENCE_OPTIONS}
          value={presence}
          onChange={setPresence}
          columns="grid-cols-3"
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="reporter">Your name</Label>
        <Input
          id="reporter"
          name="reporter"
          ref={prefillReporter}
          autoComplete="name"
          maxLength={120}
          className="h-11 text-base"
          aria-describedby="reporter-hint"
        />
        <p id="reporter-hint" className="text-sm text-muted-foreground">
          Shown with your report and remembered on this device.
        </p>
      </div>

      <PhotoField value={photo} onChange={setPhoto} />

      <div className="space-y-2">
        <Label htmlFor="note">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="note" name="note" maxLength={1000} rows={3} placeholder="Smell, colour, dead fish, anything unusual" className="text-base" />
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertTitle>Report not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={submitting}>
        {submitting && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
        {submitting ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}
