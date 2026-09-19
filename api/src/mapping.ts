import {
  CITIZEN_INDICATORS,
  OAH_CODE_SYSTEM,
  OAH_PROFILES,
  PRESENCE_SYSTEM,
  PRESENCE_VALUES,
  UCUM,
  indicatorCode,
  indicatorFromCode,
  type CitizenIndicator,
  type Presence,
} from "./oah.js";

export interface CitizenReport {
  siteId: string;
  indicator: CitizenIndicator;
  observedAt: string;
  reporter: string;
  value: number | Presence;
  note?: string;
}

export interface ObservationSummary {
  id: string;
  indicator: CitizenIndicator;
  value: number | Presence;
  unit?: string;
  observedAt: string;
  reporter: string;
}

const PRESENCE_DISPLAY: Record<Presence, string> = {
  absent: "Absent",
  present: "Present",
  abundant: "Abundant",
};

// Returns a reason the value does not fit the indicator, or undefined if it is valid.
export function checkValue(indicator: CitizenIndicator, value: unknown): string | undefined {
  const entry = CITIZEN_INDICATORS[indicator];
  if (entry.kind === "presence") {
    return PRESENCE_VALUES.includes(value as Presence)
      ? undefined
      : `${indicator} takes one of: ${PRESENCE_VALUES.join(", ")}`;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return `${indicator} takes a number`;
  if (value < entry.min || value > entry.max) {
    return `${indicator} must be between ${entry.min} and ${entry.max} ${entry.unitLabel}`;
  }
  return undefined;
}

// Maps one citizen field report onto the OAH ObservationIndicatorsOah profile.
export function toOahObservation(report: CitizenReport): fhir4.Observation {
  const indicator = CITIZEN_INDICATORS[report.indicator];

  const observation: fhir4.Observation = {
    resourceType: "Observation",
    meta: { profile: [OAH_PROFILES.observationIndicators] },
    status: "final",
    code: {
      coding: [
        { system: OAH_CODE_SYSTEM, code: indicatorCode(report.indicator), display: indicator.display },
      ],
    },
    subject: { reference: `Location/${report.siteId}` },
    effectiveDateTime: report.observedAt,
    performer: [{ display: report.reporter }],
  };

  if (indicator.kind === "quantity") {
    observation.valueQuantity = { value: Number(report.value), unit: indicator.unitLabel, system: UCUM, code: indicator.unit };
  } else {
    const presence = report.value as Presence;
    observation.valueCodeableConcept = {
      coding: [{ system: PRESENCE_SYSTEM, code: presence, display: PRESENCE_DISPLAY[presence] }],
      text: PRESENCE_DISPLAY[presence],
    };
  }

  if (report.note) observation.note = [{ text: report.note }];
  return observation;
}

// Reverse mapping for API responses; returns undefined for observations that are not citizen indicators.
export function toObservationSummary(observation: fhir4.Observation): ObservationSummary | undefined {
  const coding = observation.code.coding?.find((c) => c.system === OAH_CODE_SYSTEM);
  const indicator = indicatorFromCode(coding?.code);
  if (!indicator || !observation.id || !observation.effectiveDateTime) return undefined;

  let value: number | Presence | undefined;
  let unit: string | undefined;
  if (observation.valueQuantity?.value !== undefined) {
    value = observation.valueQuantity.value;
    unit = observation.valueQuantity.code;
  } else {
    const code = observation.valueCodeableConcept?.coding?.find((c) => c.system === PRESENCE_SYSTEM)?.code;
    if (PRESENCE_VALUES.includes(code as Presence)) value = code as Presence;
  }
  if (value === undefined) return undefined;

  return {
    id: observation.id,
    indicator,
    value,
    ...(unit ? { unit } : {}),
    observedAt: observation.effectiveDateTime,
    reporter: observation.performer?.[0]?.display ?? "Unknown",
  };
}
