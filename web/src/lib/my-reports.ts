import { readStored, writeStored } from "./storage";
import type { ReportResult } from "./types";

// The reporter's own recent reports, kept on this device only, so they can come back and see what
// happened to each one. Nothing here is sent anywhere: the ids are public FHIR Observation ids.
const MY_REPORTS_KEY = "stream-to-clinic.my-reports";
const MAX = 20;
/** Fired on window when this tab remembers a new report. */
export const MY_REPORTS_EVENT = "stream-to-clinic:my-reports";

export interface MyReport {
  id: string;
  siteId: string;
  siteName: string;
  indicator: string;
  observedAt: string;
  alerts: number;
}

export function listMyReports(): MyReport[] {
  try {
    const parsed: unknown = JSON.parse(readStored(MY_REPORTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((r): r is MyReport => typeof r?.id === "string" && typeof r?.siteId === "string") : [];
  } catch {
    return [];
  }
}

export function rememberReport(site: { id: string; name: string }, result: ReportResult): void {
  const { observation, alerts } = result;
  const entry: MyReport = { id: observation.id, siteId: site.id, siteName: site.name, indicator: observation.indicator, observedAt: observation.observedAt, alerts: alerts.length };
  writeStored(MY_REPORTS_KEY, JSON.stringify([entry, ...listMyReports().filter((r) => r.id !== entry.id)].slice(0, MAX)));
  window.dispatchEvent(new Event(MY_REPORTS_EVENT));
}
