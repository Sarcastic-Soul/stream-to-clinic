"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, CloudOffIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUEUE_EVENT, flushQueue, listQueued, type FlushOutcome, type QueuedReport } from "@/lib/report-queue";

// Shown on every page: reports waiting to be sent, and what happened to them once the connection came back.
export function ReportQueueBanner() {
  const [queued, setQueued] = useState<QueuedReport[]>([]);
  const [outcomes, setOutcomes] = useState<FlushOutcome[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => listQueued().then((items) => active && setQueued(items));
    const flush = () => {
      if (!navigator.onLine) return;
      flushQueue().then((done) => {
        if (active && done.length) setOutcomes((previous) => [...previous, ...done]);
      }, refresh);
    };

    refresh().then(flush);
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener("online", flush);
    return () => {
      active = false;
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener("online", flush);
    };
  }, []);

  const sent = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);
  const raised = sent.reduce((count, o) => count + o.result.alerts.length, 0);

  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {queued.length > 0 && (
        <div className="border-b bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm">
            <CloudOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-medium">
                {queued.length === 1 ? "1 report queued" : `${queued.length} reports queued`}, will send when online:
              </span>{" "}
              {queued.map((q) => `${q.indicatorDisplay} at ${q.siteName}`).join("; ")}.
            </p>
          </div>
        </div>
      )}
      {outcomes.length > 0 && (
        <div className="border-b bg-green-50 text-green-950 dark:bg-green-950 dark:text-green-100">
          <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm">
            {failed.length ? (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <div className="flex-1 space-y-1">
              {sent.length > 0 && (
                <p>
                  <span className="font-medium">
                    {sent.length === 1 ? "Queued report sent" : `${sent.length} queued reports sent`}
                  </span>
                  {raised > 0 && ` and ${raised === 1 ? "1 alert" : `${raised} alerts`} raised`}:{" "}
                  {sent.map((o, i) => (
                    <span key={o.item.id}>
                      {i > 0 && "; "}
                      <a href={o.result.fhirUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        {o.item.indicatorDisplay} at {o.item.siteName}
                        <span className="sr-only"> (FHIR resource, opens in a new tab)</span>
                      </a>
                    </span>
                  ))}
                  .
                </p>
              )}
              {failed.map((o) => (
                <p key={o.item.id}>
                  <span className="font-medium">
                    Not sent: {o.item.indicatorDisplay} at {o.item.siteName}.
                  </span>{" "}
                  {o.error}
                </p>
              ))}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOutcomes([])} aria-label="Dismiss" className="-my-1">
              <XIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
