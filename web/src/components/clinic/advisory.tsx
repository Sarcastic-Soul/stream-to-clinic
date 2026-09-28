"use client";

import { useState } from "react";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { FhirLink } from "@/components/fhir-link";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/hooks/use-locale";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Advisory as AdvisoryText, AlertSummary } from "@/lib/types";

// The rule engine decides; the model only rewrites its decision for the clinic desk. Keeping that
// order visible is the point of this panel — the draft sits below the reasons, never above them.
export function Advisory({ alert }: { alert: AlertSummary }) {
  const t = useTranslate();
  const [advisory, setAdvisory] = useState<AdvisoryText | undefined>(alert.advisory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setBusy(true);
    setError(null);
    try {
      setAdvisory(await api.requestAdvisory(alert.id));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? t("clinic.advisory.noModel")
          : err instanceof Error
            ? err.message
            : t("clinic.advisory.failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="advisory-heading" className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <h2 id="advisory-heading" className="flex items-center gap-2 font-semibold">
          <SparklesIcon className="size-5" aria-hidden />
          {t("clinic.advisory.title")}
        </h2>
        <InfoTip label={t("common.moreInfo")}>{t("clinic.advisory.info")}</InfoTip>
      </div>

      {advisory ? (
        <div className="space-y-2">
          {advisory.text.split("\n").filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("clinic.advisory.draftedBy", { model: advisory.model })} ·{" "}
              <time dateTime={advisory.generatedAt}>{formatDateTime(advisory.generatedAt)}</time>
            </span>
            <FhirLink href={advisory.fhirUrl}>Communication</FhirLink>
            <InfoTip label={t("common.moreInfo")}>{t("clinic.advisory.storedInfo")}</InfoTip>
          </p>
        </div>
      ) : (
        <Button type="button" onClick={draft} disabled={busy} variant="outline">
          {busy ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {busy ? t("clinic.advisory.drafting") : t("clinic.advisory.draft")}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
