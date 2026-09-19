// Rule-based risk engine (docs/PLAN.md section 7). Pure functions: observations and weather in,
// decisions with plain-language reasons out. Demo heuristics, not clinical guidance.
import type { ObservationSummary } from "./mapping.js";
import type { CitizenIndicator } from "./oah.js";

export type RiskId = "algal-bloom" | "sewage-overflow" | "mosquito-breeding" | "low-oxygen";
export type RiskLevel = "none" | "low" | "medium" | "high";

export const RISK_LEVELS: readonly RiskLevel[] = ["none", "low", "medium", "high"];

export const RISKS: Record<RiskId, { title: string; watchFor: string }> = {
  "algal-bloom": {
    title: "Possible algal bloom",
    watchFor:
      "Skin irritation, rashes and gastrointestinal symptoms (nausea, vomiting, diarrhoea) after contact with stream water.",
  },
  "sewage-overflow": {
    title: "Possible sewage overflow",
    watchFor: "Gastrointestinal infections (diarrhoea, vomiting, fever) in people exposed to stream water.",
  },
  "mosquito-breeding": {
    title: "Mosquito breeding conditions",
    watchFor: "Vector-borne disease: unexplained fever, headache, rash or joint pain after mosquito bites.",
  },
  // Environmental only: no clinic communication.
  "low-oxygen": { title: "Low dissolved oxygen", watchFor: "" },
};

export const THRESHOLDS = {
  windowDays: 7,
  bloomWaterTempC: 25,
  bloomMaxRain7dMm: 5,
  sewageMinRain24hMm: 20,
  sewageFoamWindowHours: 48,
  mosquitoWaterTempC: 20,
  mosquitoMinRain7dMm: 1,
  lowOxygenMgL: 4,
  severeOxygenMgL: 2,
} as const;

export interface Weather {
  rain24h: number; // mm
  rain7d: number; // mm
  source: string; // shown in reasons, e.g. "Open-Meteo"
}

export interface Condition {
  text: string;
  met: boolean;
  evidence: string[]; // Observation ids supporting the condition
}

export interface RiskDecision {
  risk: RiskId;
  fired: boolean;
  level: RiskLevel;
  conditions: Condition[];
}

const HOUR = 3_600_000;
const T = THRESHOLDS;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};
const mm = (value: number) => `${value.toFixed(1)} mm`;

export function evaluateRisks(
  observations: ObservationSummary[],
  weather: Weather | undefined,
  now = new Date(),
): RiskDecision[] {
  // Most recent report of an indicator within the look-back window (future timestamps ignored).
  const latest = (indicator: CitizenIndicator, hours = T.windowDays * 24) =>
    observations
      .filter((o) => o.indicator === indicator)
      .filter((o) => {
        const age = now.getTime() - Date.parse(o.observedAt);
        return age >= -5 * 60_000 && age <= hours * HOUR;
      })
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];

  const presence = (indicator: CitizenIndicator, label: string, hours = T.windowDays * 24): Condition => {
    const obs = latest(indicator, hours);
    const window = hours <= 48 ? `${hours} hours` : `${hours / 24} days`;
    if (!obs) return { text: `No ${label} reported in the last ${window}.`, met: false, evidence: [] };
    const met = obs.value === "present" || obs.value === "abundant";
    return {
      text: met
        ? `${capitalise(label)} reported as ${obs.value} on ${day(obs.observedAt)}.`
        : `Latest ${label} report (${day(obs.observedAt)}) was ${obs.value}.`,
      met,
      evidence: met ? [obs.id] : [],
    };
  };

  const waterAtLeast = (threshold: number): Condition => {
    const obs = latest("waterTemperature");
    if (!obs) return { text: `No water temperature reading in the last ${T.windowDays} days.`, met: false, evidence: [] };
    const met = Number(obs.value) >= threshold;
    return {
      text: `Water temperature ${obs.value} °C on ${day(obs.observedAt)} is ${met ? "at or above" : "below"} ${threshold} °C.`,
      met,
      evidence: met ? [obs.id] : [],
    };
  };

  // Rainfall condition; the text names the weather source.
  const rain = (test: (w: Weather) => boolean, describe: (w: Weather, met: boolean) => string): Condition => {
    if (!weather) {
      return { text: "Rainfall could not be checked: the weather service is unavailable.", met: false, evidence: [] };
    }
    const met = test(weather);
    return { text: `${describe(weather, met)} (${weather.source}).`, met, evidence: [] };
  };

  const decide = (risk: RiskId, conditions: Condition[], level: RiskLevel): RiskDecision => {
    const fired = conditions.every((c) => c.met);
    return { risk, fired, level: fired ? level : "none", conditions };
  };

  const algae = latest("filamentousAlgae");
  const diptera = latest("diptera");
  const oxygen = latest("dissolvedO2");

  return [
    decide(
      "algal-bloom",
      [
        presence("filamentousAlgae", "filamentous algae"),
        waterAtLeast(T.bloomWaterTempC),
        rain(
          (w) => w.rain7d <= T.bloomMaxRain7dMm,
          (w, met) =>
            met
              ? `Dry week: ${mm(w.rain7d)} of rain in the last 7 days, at most ${T.bloomMaxRain7dMm} mm`
              : `${mm(w.rain7d)} of rain in the last 7 days, more than ${T.bloomMaxRain7dMm} mm`,
        ),
      ],
      algae?.value === "abundant" ? "high" : "medium",
    ),
    decide(
      "sewage-overflow",
      [
        rain(
          (w) => w.rain24h >= T.sewageMinRain24hMm,
          (w, met) =>
            met
              ? `Heavy rain: ${mm(w.rain24h)} in the last 24 hours, at least ${T.sewageMinRain24hMm} mm`
              : `${mm(w.rain24h)} of rain in the last 24 hours, below ${T.sewageMinRain24hMm} mm`,
        ),
        presence("foam", "foam, colour or smell", T.sewageFoamWindowHours),
      ],
      "high",
    ),
    decide(
      "mosquito-breeding",
      [
        presence("diptera", "diptera (mosquito larvae)"),
        waterAtLeast(T.mosquitoWaterTempC),
        rain(
          (w) => w.rain7d >= T.mosquitoMinRain7dMm,
          (w, met) =>
            met
              ? `Recent rain: ${mm(w.rain7d)} in the last 7 days can leave standing water`
              : `Almost no rain in the last 7 days: ${mm(w.rain7d)}`,
        ),
      ],
      diptera?.value === "abundant" ? "high" : "medium",
    ),
    decide(
      "low-oxygen",
      [
        oxygen
          ? {
              text: `Dissolved oxygen ${oxygen.value} mg/L on ${day(oxygen.observedAt)} is ${
                Number(oxygen.value) < T.lowOxygenMgL ? "below" : "at or above"
              } ${T.lowOxygenMgL} mg/L.`,
              met: Number(oxygen.value) < T.lowOxygenMgL,
              evidence: Number(oxygen.value) < T.lowOxygenMgL ? [oxygen.id] : [],
            }
          : { text: `No dissolved oxygen reading in the last ${T.windowDays} days.`, met: false, evidence: [] },
      ],
      Number(oxygen?.value) < T.severeOxygenMgL ? "medium" : "low",
    ),
  ];
}

export function highestLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((max, l) => (RISK_LEVELS.indexOf(l) > RISK_LEVELS.indexOf(max) ? l : max), "none");
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
