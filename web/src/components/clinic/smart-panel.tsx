"use client";

import { useState } from "react";
import { LoaderCircleIcon, LogOutIcon, MonitorSmartphoneIcon, ShieldCheckIcon } from "lucide-react";
import { FhirLink } from "@/components/fhir-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSmartSession } from "@/hooks/use-smart-session";
import { API_URL, MOCK } from "@/lib/api";
import { demoEhrUrl, signOutSmart, startSmartLaunch } from "@/lib/smart";
import type { ClinicSummary } from "@/lib/types";

/**
 * SMART on FHIR for the clinic view: sign in as the clinic's clinician (standalone launch) or open
 * the app from the demo EHR (EHR launch). Signed in, the clinic's replies carry the clinician's name
 * as a FHIR Provenance. The mock API has no authorization server, so the panel hides there.
 */
export function SmartPanel({ clinic }: { clinic: ClinicSummary }) {
  const session = useSmartSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (MOCK) return null;

  if (session?.clinicId === clinic.id) {
    return (
      <div
        data-testid="smart-session"
        className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent p-3 animate-in fade-in slide-in-from-top-2 duration-500"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/30">
          <ShieldCheckIcon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            Signed in as <span data-testid="smart-user">{session.practitionerName}</span>
          </p>
          <p className="text-muted-foreground">
            SMART on FHIR · {session.launch === "ehr" ? "launched from the EHR" : "standalone launch"} · replies are signed
          </p>
          {session.fhirUser && (
            <p className="mt-0.5">
              <FhirLink href={session.fhirUser}>{session.fhirUser.split("/").slice(-2).join("/")}</FhirLink>
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={signOutSmart}>
          <LogOutIcon data-icon="inline-start" aria-hidden />
          Sign out
        </Button>
      </div>
    );
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await startSmartLaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sign-in.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3" data-testid="smart-panel">
      <p className="text-sm text-muted-foreground">
        {session
          ? `Signed in for another clinic as ${session.practitionerName}. Sign in for this one to sign its replies.`
          : "Clinicians can sign in with SMART on FHIR, so replies to alerts carry their name as a FHIR Provenance."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={signIn} disabled={busy} data-testid="smart-sign-in">
          {busy ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <ShieldCheckIcon data-icon="inline-start" aria-hidden />}
          Sign in with SMART on FHIR
        </Button>
        <a href={demoEhrUrl(API_URL, clinic.id)} className={buttonVariants({ size: "sm", variant: "outline" })} data-testid="smart-ehr">
          <MonitorSmartphoneIcon data-icon="inline-start" aria-hidden />
          Open from the demo EHR
        </a>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
