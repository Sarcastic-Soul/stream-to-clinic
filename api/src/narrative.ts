// Step-by-step, plain-language account of how the risk engine reached an alert. Stored as numbered
// lines in DetectedIssue.detail, so the explanation travels with the standard FHIR resource.
import { RISKS, THRESHOLDS, mm, type RiskDecision, type Weather } from "./rules.js";

export interface NarrativeInput {
  decision: RiskDecision;
  siteName: string;
  reportCount: number; // citizen reports from the site inside the look-back window
  weather: Weather | undefined;
  clinics: string[]; // names of the clinics notified
}

const HEADING = "How the risk engine decided:";
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function buildNarrative({ decision, siteName, reportCount, weather, clinics }: NarrativeInput): string[] {
  const { title, watchFor, usesWeather } = RISKS[decision.risk];
  const { conditions } = decision;
  const steps = [
    `Reviewed ${plural(reportCount, "citizen report")} from ${siteName} in the last ${THRESHOLDS.windowDays} days.`,
  ];
  if (usesWeather) {
    steps.push(
      weather
        ? `Weather from ${weather.source}: ${mm(weather.rain24h)} of rain in the last 24 hours and ${mm(weather.rain7d)} in the last 7 days.`
        : "The weather service was unavailable, so rainfall could not be checked.",
    );
  }
  conditions.forEach((c, i) => steps.push(`Check ${i + 1} of ${conditions.length} (${c.met ? "met" : "not met"}): ${c.text}`));
  const all = conditions.length === 1 ? "The condition was met" : `All ${conditions.length} conditions were met`;
  steps.push(`${all}, so the engine raised "${title}" at ${decision.level} level because ${decision.levelReason}.`);
  if (!watchFor) steps.push("Environmental risk: no clinic notified.");
  else if (!clinics.length) steps.push("No clinic is registered for this site, so none was notified.");
  else steps.push(`Notified ${plural(clinics.length, "clinic")} serving this site: ${clinics.join(", ")}.`);
  return steps;
}

export function narrativeText(narrative: string[]): string {
  return [HEADING, ...narrative.map((step, i) => `${i + 1}. ${step}`)].join("\n");
}

// Reads the numbered steps back out of DetectedIssue.detail; empty when the issue predates narratives.
export function parseNarrative(detail: string | undefined): string[] {
  const lines = detail?.split("\n") ?? [];
  const start = lines.indexOf(HEADING);
  if (start < 0) return [];
  return lines.slice(start + 1).flatMap((line) => line.match(/^\d+\. (.+)$/)?.[1] ?? []);
}
