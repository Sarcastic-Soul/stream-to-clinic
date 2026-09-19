import {
  CITIZEN_INDICATORS,
  OAH_CODE_SYSTEM,
  OAH_PROFILES,
  indicatorCode,
  type CitizenIndicator,
} from "./oah.js";

export interface CitizenReport {
  siteId: string;
  indicator: CitizenIndicator;
  observedAt: string;
  reporter: string;
  value: number | string;
  note?: string;
}

// Maps one citizen field report onto the OAH ObservationIndicatorsOah profile.
export function toOahObservation(report: CitizenReport): fhir4.Observation {
  const indicator = CITIZEN_INDICATORS[report.indicator];
  const unit = "unit" in indicator ? indicator.unit : undefined;

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

  if (typeof report.value === "number" && unit) {
    observation.valueQuantity = {
      value: report.value,
      unit,
      system: "http://unitsofmeasure.org",
      code: unit,
    };
  } else {
    observation.valueCodeableConcept = { text: String(report.value) };
  }

  if (report.note) observation.note = [{ text: report.note }];
  return observation;
}
