"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCard } from "@/components/alert-card";
import { AlertBanner, LiveIndicator } from "@/components/clinic/live-alerts";
import { InfoTip } from "@/components/info-tip";
import { PushToggle } from "@/components/clinic/push-toggle";
import { SmartPanel } from "@/components/clinic/smart-panel";
import { LoadError, LoadingRows } from "@/components/status";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useTranslate } from "@/hooks/use-locale";
import { useLiveAlerts, type Arrival } from "@/hooks/use-live-alerts";
import { api } from "@/lib/api";
import { readStored, writeStored } from "@/lib/storage";

const CLINIC_KEY = "stream-to-clinic.clinic";

const clinicUrl = (id: string) => `/clinic?clinic=${encodeURIComponent(id)}`;

export function ClinicHeader() {
  const t = useTranslate();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{t("clinic.title")}</h1>
        <InfoTip label={t("common.moreInfo")}>{t("clinic.titleInfo")}</InfoTip>
      </div>
      <p className="text-muted-foreground">{t("clinic.subtitle")}</p>
    </div>
  );
}

export function ClinicDashboard({ clinicId }: { clinicId?: string }) {
  const t = useTranslate();
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

  if (clinics.error) return <LoadError error={clinics.error} />;
  if (!clinics.data) return <LoadingRows rows={3} label={t("clinic.loadingClinics")} />;

  const fresh = new Set(live.arrivals.map((a) => a.alert.id));
  const sorted =
    alerts.data &&
    [...live.arrivals.map((a) => a.alert), ...alerts.data.filter((a) => !fresh.has(a.id))].sort((a, b) =>
      fresh.has(a.id) === fresh.has(b.id) ? b.createdAt.localeCompare(a.createdAt) : fresh.has(a.id) ? -1 : 1,
    );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="clinic">{t("clinic.yourClinic")}</Label>
        <Select
          items={clinics.data.map((c) => ({ value: c.id, label: `${c.name}, ${c.city}` }))}
          value={clinic ? clinic.id : null}
          onValueChange={choose}
        >
          <SelectTrigger id="clinic" className="h-11 w-full">
            <SelectValue placeholder={t("clinic.chooseClinic")} />
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
            {clinic.siteIds.length === 1 ? t("clinic.sitesOne") : t("clinic.sitesMany", { count: clinic.siteIds.length })}
          </p>
        )}
        {clinicId && <PushToggle clinicId={clinicId} />}
        {clinic && <SmartPanel clinic={clinic} />}
      </div>

      {banner && clinicId && <AlertBanner arrival={banner} clinicId={clinicId} onDismiss={dismissBanner} />}

      {!clinicId && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("clinic.pickClinic")}
          <InfoTip label={t("common.moreInfo")}>{t("clinic.pickInfo")}</InfoTip>
        </p>
      )}

      {clinicId && (
        <section aria-labelledby="alerts-heading" className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 id="alerts-heading" className="text-lg font-semibold">
              {sorted ? t("clinic.alertsCount", { count: sorted.length }) : t("clinic.alerts")}
            </h2>
            <LiveIndicator status={live.status} className="ml-auto" />
          </div>
          {alerts.loading && <LoadingRows rows={3} label={t("clinic.loadingAlerts")} />}
          {alerts.error && <LoadError error={alerts.error} />}
          {sorted?.length === 0 && (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">{t("clinic.noAlerts")}</p>
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
