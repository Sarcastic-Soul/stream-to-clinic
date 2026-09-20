import type { Translate } from "./i18n";
import type { AckAction, Indicator, ObservationSummary, Presence, RiskLevel } from "./types";

export const RISK: Record<RiskLevel, { label: string; color: string; badge: string }> = {
  none: {
    label: "No active alert",
    color: "#16a34a",
    badge: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  low: {
    label: "Low risk",
    color: "#ca8a04",
    badge: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  },
  medium: {
    label: "Medium risk",
    color: "#ea580c",
    badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  },
  high: {
    label: "High risk",
    color: "#dc2626",
    badge: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
};

export const RISK_LEVELS: RiskLevel[] = ["none", "low", "medium", "high"];

// What a clinic can report back about an alert. Mirrors ACK_ACTIONS in api/src/alerts.ts.
export const ACK_ACTIONS: Record<AckAction, string> = {
  "staff-briefed": "Clinic staff briefed",
  "patients-advised": "Patients advised about the water",
  "authority-notified": "Local health authority notified",
  "no-action": "Noted, no action needed",
};

export const ACK_ACTION_IDS = Object.keys(ACK_ACTIONS) as AckAction[];

// Indicator names come from the API in English. The citizen-facing screens show the translated
// name where one exists and fall back to what the API said, so a new indicator still renders.
export function indicatorLabel(t: Translate, indicator: Pick<Indicator, "id" | "display">): string {
  const key = `indicator.${indicator.id}` as Parameters<Translate>[0];
  const translated = t(key);
  return translated === key ? indicator.display : translated;
}

export function presenceLabel(t: Translate, presence: Presence): string {
  return t(`presence.${presence}` as Parameters<Translate>[0]);
}

// Unit to print after a value; "" for dimensionless indicators (pH), whose name already says it.
export function unitLabel(indicator: Pick<Indicator, "unit" | "unitLabel"> | undefined, fallback?: string): string {
  const unit = indicator?.unit ?? fallback;
  if (unit === "[pH]") return "";
  return indicator?.unitLabel ?? unit ?? "";
}

export function formatValue(observation: Pick<ObservationSummary, "value" | "unit">, indicator?: Indicator): string {
  const { value } = observation;
  if (typeof value === "string") return value.charAt(0).toUpperCase() + value.slice(1);
  return `${value} ${unitLabel(indicator, observation.unit)}`.trim();
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatShortDate = (value: string | number) => shortDate.format(new Date(value));

// Great-circle distance in kilometres.
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
