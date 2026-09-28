// In-process hub for alerts the moment they are raised. The FHIR Communications are the record;
// this only tells open clinic pages (Server-Sent Events) and installed clinic apps (web push) that
// one was just written, so nobody has to poll.
import { EventEmitter } from "node:events";
import type { AlertSummary } from "./alerts.js";

export interface RaisedAlert {
  alert: AlertSummary;
  /** Clinics a Communication was sent to; empty for environmental-only risks. */
  clinicIds: string[];
}

export const alertEvents = new EventEmitter<{ raised: [RaisedAlert] }>();
// One listener per open clinic page; the SSE route caps how many there can be.
alertEvents.setMaxListeners(0);

/** SSE frame for one alert. */
export const sseFrame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Whether an open page watching `clinicId` (or every clinic, when unset) should hear about this alert. */
export const isFor = (clinicId: string | undefined, raised: RaisedAlert) =>
  clinicId ? raised.clinicIds.includes(clinicId) : true;
