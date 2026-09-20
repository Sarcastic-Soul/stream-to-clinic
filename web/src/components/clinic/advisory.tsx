"use client";

import { useState } from "react";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { FhirLink } from "@/components/fhir-link";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Advisory as AdvisoryText, AlertSummary } from "@/lib/types";

// The rule engine decides; the model only rewrites its decision for the clinic desk. Keeping that
// order visible is the point of this panel — the draft sits below the reasons, never above them.
export function Advisory({ alert }: { alert: AlertSummary }) {
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
          ? "No advisory model is configured on this server. The alert above is unaffected: it comes from the rules, not from a model."
          : err instanceof Error
            ? err.message
            : "The advisory could not be drafted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="advisory-heading" className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 id="advisory-heading" className="flex items-center gap-2 font-semibold">
          <SparklesIcon className="size-5" aria-hidden />
          Notice for the clinic desk
        </h2>
        <p className="text-sm text-muted-foreground">
          A language model rewrites the reasons above as something a receptionist can read out. It is given this alert&apos;s
          own reasons and nothing else, and it cannot change the risk or its level.
        </p>
      </div>

      {advisory ? (
        <div className="space-y-2">
          {advisory.text.split("\n").filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="text-sm text-muted-foreground">
            Drafted by {advisory.model} on <time dateTime={advisory.generatedAt}>{formatDateTime(advisory.generatedAt)}</time>. Stored
            as <FhirLink href={advisory.fhirUrl}>a FHIR Communication</FhirLink> sent by a <code>Device</code>, with a{" "}
            <code>Provenance</code> naming that device as the author — so machine-written text stays marked as such wherever it is
            read.
          </p>
        </div>
      ) : (
        <Button type="button" onClick={draft} disabled={busy} variant="outline">
          {busy ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {busy ? "Drafting…" : "Draft the notice"}
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
