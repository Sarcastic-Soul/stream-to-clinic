"use client";

import { useState } from "react";
import { CircleAlertIcon, LoaderCircleIcon, ReplyIcon } from "lucide-react";
import { ChoiceGroup } from "@/components/choice-group";
import { FhirLink } from "@/components/fhir-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ACK_ACTIONS, ACK_ACTION_IDS, formatDateTime } from "@/lib/format";
import type { AckAction, AlertSummary, ClinicSummary } from "@/lib/types";

interface Props {
  alert: AlertSummary;
  /** The clinic reading the alert, from ?clinic= on the URL. */
  clinic?: ClinicSummary;
  onAcknowledged: (alert: AlertSummary) => void;
}

// A notified clinic replies: what it did about the alert. The reply is stored as a FHIR
// Communication pointing back at the one we sent, so the loop closes in standard resources.
export function Acknowledge({ alert, clinic, onAcknowledged }: Props) {
  const [action, setAction] = useState<AckAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replies = alert.acknowledgements ?? [];
  const notified = alert.watchFor !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!clinic || !action) return;
    setSubmitting(true);
    setError(null);
    try {
      onAcknowledged(await api.acknowledgeAlert(alert.id, { clinicId: clinic.id, action, note }));
      setAction(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the response.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="response-heading" className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 id="response-heading" className="flex items-center gap-2 font-semibold">
          <ReplyIcon className="size-5" aria-hidden />
          Clinic response
        </h2>
        <p className="text-sm text-muted-foreground">
          What the notified clinics did. Each response is a FHIR <code>Communication</code> linked to the alert, so
          the environmental side can see which warnings led to action.
        </p>
      </div>

      {replies.length > 0 && (
        <ul className="space-y-2">
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-lg border bg-card p-3 text-sm">
              <p className="font-medium">{reply.actionLabel}</p>
              <p className="text-muted-foreground">
                {reply.clinicName} · <time dateTime={reply.at}>{formatDateTime(reply.at)}</time>
              </p>
              {reply.note && <p className="mt-1">{reply.note}</p>}
              <p className="mt-1">
                <FhirLink href={reply.fhirUrl}>Communication/{reply.id}</FhirLink>
              </p>
            </li>
          ))}
        </ul>
      )}

      {!notified ? (
        <p className="text-sm text-muted-foreground">
          Environmental alerts are not sent to clinics, so there is nothing to respond to.
        </p>
      ) : !clinic ? (
        <p className="text-sm text-muted-foreground">
          {replies.length === 0 && "No response yet. "}
          Open this alert from a clinic&apos;s dashboard to respond to it.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <ChoiceGroup
            legend={`Respond as ${clinic.name}`}
            name="ack-action"
            options={ACK_ACTION_IDS.map((id) => ({ value: id, label: ACK_ACTIONS[id] }))}
            value={action}
            onChange={setAction}
            columns="grid-cols-1 sm:grid-cols-2"
          />

          <div className="space-y-2">
            <Label htmlFor="ack-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="ack-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Cases seen, advice given, who was told"
              className="text-base"
            />
          </div>

          {error && (
            <Alert variant="destructive" role="alert">
              <CircleAlertIcon />
              <AlertTitle>Response not sent</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={!action || submitting}>
            {submitting && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
            {submitting ? "Sending…" : "Send response"}
          </Button>
        </form>
      )}
    </section>
  );
}
