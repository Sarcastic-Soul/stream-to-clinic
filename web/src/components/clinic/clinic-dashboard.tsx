"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCard } from "@/components/alert-card";
import { AlertBanner, LiveIndicator } from "@/components/clinic/live-alerts";
import { PushToggle } from "@/components/clinic/push-toggle";
import { SmartPanel } from "@/components/clinic/smart-panel";
import { LoadError, LoadingRows } from "@/components/status";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useLiveAlerts, type Arrival } from "@/hooks/use-live-alerts";
import { api } from "@/lib/api";
import { readStored, writeStored } from "@/lib/storage";

const CLINIC_KEY = "stream-to-clinic.clinic";

const clinicUrl = (id: string) => `/clinic?clinic=${encodeURIComponent(id)}`;

export function ClinicDashboard({ clinicId }: { clinicId?: string }) {
  const router = useRouter();
  const clinics = useApi(api.getClinics);
  const alerts = useApi(useMemo(() => (clinicId ? () => api.getAlerts({ clinicId }) : null), [clinicId]));
  const clinic = clinics.data?.find((c) => c.id === clinicId);
  // Alerts raised while the page is open arrive over the live stream and go on top of the list.
  const [banner, setBanner] = useState<Arrival | null>(null);
  const live = useLiveAlerts(clinicId, setBanner);
  const dismissBanner = useCallback(() => setBanner(null), []);

  // Reopen the clinic chosen last time on this device.
  useEffect(() => {
    const stored = clinicId ? null : readStored(CLINIC_KEY);
    if (stored) router.replace(clinicUrl(stored));
  }, [clinicId, router]);

  function choose(id: string | null) {
    if (!id) return;
    writeStored(CLINIC_KEY, id);
    router.replace(clinicUrl(id));
  }

  if (clinics.error) return <LoadError error={clinics.error} what="clinics" />;
  if (!clinics.data) return <LoadingRows rows={3} label="Loading clinics" />;

  const fresh = new Set(live.arrivals.map((a) => a.alert.id));
  const sorted =
    alerts.data &&
    [...live.arrivals.map((a) => a.alert), ...alerts.data.filter((a) => !fresh.has(a.id))].sort((a, b) =>
      fresh.has(a.id) === fresh.has(b.id) ? b.createdAt.localeCompare(a.createdAt) : fresh.has(a.id) ? -1 : 1,
    );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="clinic">Your clinic</Label>
        <Select
          items={clinics.data.map((c) => ({ value: c.id, label: `${c.name}, ${c.city}` }))}
          value={clinic ? clinic.id : null}
          onValueChange={choose}
        >
          <SelectTrigger id="clinic" className="h-11 w-full">
            <SelectValue placeholder="Choose a clinic" />
          </SelectTrigger>
          <SelectContent>
            {clinics.data.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}, {c.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clinic && (
          <p className="text-sm text-muted-foreground">
            Receives alerts for {clinic.siteIds.length} stream {clinic.siteIds.length === 1 ? "site" : "sites"}.
          </p>
        )}
        {clinicId && <PushToggle clinicId={clinicId} />}
        {clinic && <SmartPanel clinic={clinic} />}
      </div>

      {banner && clinicId && <AlertBanner arrival={banner} clinicId={clinicId} onDismiss={dismissBanner} />}

      {!clinicId && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Pick a clinic to see the early warnings for the streams it serves, each with the citizen readings and
          weather behind it. The same alerts leave the server as FHIR <code>Communication</code> resources, so a
          clinical system can subscribe to them instead of this page.
        </p>
      )}

      {clinicId && (
        <section aria-labelledby="alerts-heading" className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 id="alerts-heading" className="text-lg font-semibold">
              Alerts{sorted ? ` (${sorted.length})` : ""}
            </h2>
            <LiveIndicator status={live.status} className="ml-auto" />
          </div>
          {alerts.loading && <LoadingRows rows={3} label="Loading alerts" />}
          {alerts.error && <LoadError error={alerts.error} what="alerts" />}
          {sorted?.length === 0 && (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              No alerts for the sites near this clinic. New alerts appear here as soon as citizen reports trigger them.
            </p>
          )}
          <ul className="space-y-2">
            {sorted?.map((alert) => (
              <li
                key={alert.id}
                data-new={fresh.has(alert.id) || undefined}
                className="rounded-xl data-new:animate-in data-new:fade-in data-new:slide-in-from-top-4 data-new:ring-2 data-new:ring-sky-400 data-new:duration-700"
              >
                <AlertCard alert={alert} clinicId={clinicId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
