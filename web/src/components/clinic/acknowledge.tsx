"use client";

import { useState } from "react";
import { CircleAlertIcon, LoaderCircleIcon, ReplyIcon, ShieldCheckIcon } from "lucide-react";
import { ChoiceGroup } from "@/components/choice-group";
import { FhirLink } from "@/components/fhir-link";
import { InfoTip } from "@/components/info-tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslate } from "@/hooks/use-locale";
import { useSmartSession } from "@/hooks/use-smart-session";
import { api, ApiError, MOCK } from "@/lib/api";
import { signOutSmart } from "@/lib/smart";
import { ACK_ACTION_IDS, ackLabel, formatDateTime } from "@/lib/format";
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
  const t = useTranslate();
  const [action, setAction] = useState<AckAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useSmartSession();
  const signer = session && clinic && session.clinicId === clinic.id ? session : null;

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
      if (err instanceof ApiError && err.status === 401) signOutSmart();
      setError(err instanceof Error ? err.message : t("clinic.ack.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="response-heading" className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <h2 id="response-heading" className="flex items-center gap-2 font-semibold">
          <ReplyIcon className="size-5" aria-hidden />
          {t("clinic.ack.title")}
        </h2>
        <InfoTip label={t("common.moreInfo")}>{t("clinic.ack.info")}</InfoTip>
      </div>

      {replies.length > 0 && (
        <ul className="space-y-2">
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-lg border bg-card p-3 text-sm">
              <p className="font-medium">{ackLabel(t, reply.action)}</p>
              <p className="text-muted-foreground">
                {reply.clinicName} · <time dateTime={reply.at}>{formatDateTime(reply.at)}</time>
              </p>
              {reply.note && <p className="mt-1">{reply.note}</p>}
              {reply.signedBy && (
                <p className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" data-testid="reply-signed">
                  <ShieldCheckIcon className="size-4" aria-hidden />
                  {t("clinic.ack.signedBy", { name: reply.signedBy.name })}
                </p>
              )}
              <p className="mt-1 flex flex-wrap gap-x-3">
                <FhirLink href={reply.fhirUrl}>Communication/{reply.id}</FhirLink>
                {reply.signedBy && <FhirLink href={reply.signedBy.provenance}>Provenance/{reply.signedBy.provenance.split("/").pop()}</FhirLink>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!notified ? (
        <p className="text-sm text-muted-foreground">{t("common.environmentalInfo")}</p>
      ) : !clinic ? (
        <p className="text-sm text-muted-foreground">
          {replies.length === 0 && `${t("clinic.ack.noneYet")} `}
          {t("clinic.ack.openFromClinic")}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <ChoiceGroup
            legend={t("clinic.ack.respondAs", { name: clinic.name })}
            name="ack-action"
            options={ACK_ACTION_IDS.map((id) => ({ value: id, label: ackLabel(t, id) }))}
            value={action}
            onChange={setAction}
            columns="grid-cols-1 sm:grid-cols-2"
          />

          <div className="space-y-2">
            <Label htmlFor="ack-note">
              {t("clinic.ack.note")} <span className="font-normal text-muted-foreground">{t("clinic.ack.optional")}</span>
            </Label>
            <Textarea
              id="ack-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t("clinic.ack.placeholder")}
              className="text-base"
            />
          </div>

          {!MOCK && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="ack-signer">
              {signer ? (
                <>
                  <ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  {t("clinic.ack.signedAs", { name: signer.practitionerName })} · SMART on FHIR
                </>
              ) : (
                <>
                  {t("clinic.ack.unsigned")}
                  <InfoTip label={t("common.moreInfo")}>{t("clinic.ack.unsignedInfo")}</InfoTip>
                </>
              )}
            </p>
          )}

          {error && (
            <Alert variant="destructive" role="alert">
              <CircleAlertIcon />
              <AlertTitle>{t("clinic.ack.notSent")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={!action || submitting}>
            {submitting && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
            {submitting ? t("clinic.ack.sending") : t("clinic.ack.send")}
          </Button>
        </form>
      )}
    </section>
  );
}
