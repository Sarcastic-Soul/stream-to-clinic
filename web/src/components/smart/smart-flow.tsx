"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleAlertIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { completeSmartLaunch, startSmartLaunch } from "@/lib/smart";

function Progress({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center" role="status" data-testid="smart-progress">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/25" aria-hidden />
        <span className="absolute inset-2 rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-500/30" aria-hidden />
        <ShieldCheckIcon className="relative size-9 text-white" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {detail}
        </p>
      </div>
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <div className="space-y-4 py-10" data-testid="smart-error">
      <Alert variant="destructive" role="alert">
        <CircleAlertIcon />
        <AlertTitle>SMART on FHIR sign-in did not finish</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Link href="/clinic" className={buttonVariants({ variant: "outline" })}>
        Back to clinic alerts
      </Link>
    </div>
  );
}

/** /smart/launch: the EHR opens the app here with iss and launch; hand over to the authorize endpoint. */
export function SmartLaunch({ iss, launch }: { iss?: string; launch?: string }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSmartLaunch({ iss, launch }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Launch failed."));
  }, [iss, launch]);

  if (error) return <Failed message={error} />;
  return <Progress title={launch ? "Opening from your EHR" : "Connecting to the FHIR server"} detail="Asking the authorization server for access…" />;
}

/** /smart/callback: swap the code for a token, then open the clinic the token is for. */
export function SmartCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeSmartLaunch(new URLSearchParams(window.location.search))
      .then((session) => router.replace(`/clinic?clinic=${encodeURIComponent(session.clinicId)}`))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Sign-in failed."));
  }, [router]);

  if (error) return <Failed message={error} />;
  return <Progress title="Signing you in" detail="Exchanging the authorization code for an access token…" />;
}
