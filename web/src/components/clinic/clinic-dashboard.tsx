"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { AlertCard } from "@/components/alert-card";
import { LoadError, LoadingRows } from "@/components/status";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { readStored, writeStored } from "@/lib/storage";

const CLINIC_KEY = "stream-to-clinic.clinic";

const clinicUrl = (id: string) => `/clinic?clinic=${encodeURIComponent(id)}`;

export function ClinicDashboard({ clinicId }: { clinicId?: string }) {
  const router = useRouter();
  const clinics = useApi(api.getClinics);
  const alerts = useApi(useMemo(() => (clinicId ? () => api.getAlerts({ clinicId }) : null), [clinicId]));
  const clinic = clinics.data?.find((c) => c.id === clinicId);

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

  const sorted = alerts.data && [...alerts.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
      </div>

      {clinicId && (
        <section aria-labelledby="alerts-heading" className="space-y-3">
          <h2 id="alerts-heading" className="text-lg font-semibold">
            Alerts{sorted ? ` (${sorted.length})` : ""}
          </h2>
          {alerts.loading && <LoadingRows rows={3} label="Loading alerts" />}
          {alerts.error && <LoadError error={alerts.error} what="alerts" />}
          {sorted?.length === 0 && (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              No alerts for the sites near this clinic. New alerts appear here as soon as citizen reports trigger them.
            </p>
          )}
          <ul className="space-y-2">
            {sorted?.map((alert) => (
              <li key={alert.id}>
                <AlertCard alert={alert} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
