// Identifiers from the OneAquaHealth FHIR IG (github.com/hl7-eu/oah, FHIR 4.0.1, draft).
const OAH_CANONICAL = "http://hl7.eu/fhir/ig/oah";

export const OAH_PROFILES = {
  observationIndicators: `${OAH_CANONICAL}/StructureDefinition/observation-indicators-oah`,
  observationHealthMeasure: `${OAH_CANONICAL}/StructureDefinition/observation-health-measure-oah`,
  location: `${OAH_CANONICAL}/StructureDefinition/location-oah`,
  group: `${OAH_CANONICAL}/StructureDefinition/group-oah`,
} as const;

export const OAH_CODE_SYSTEM = `${OAH_CANONICAL}/CodeSystem/temporarySystem-oah-eu`;

// Subset of the OAH temporary code system that citizens can report from the field.
export const CITIZEN_INDICATORS = {
  waterTemperature: { display: "Water temperature", unit: "Cel" },
  pH: { display: "pH", unit: "[pH]" },
  dissolvedO2: { display: "Dissolved O2", unit: "mg/L" },
  conductivity: { display: "Conductivity", unit: "uS/cm" },
  foam: { display: "Foam/colour/smell" },
  filamentousAlgae: { code: "filamentous-algae", display: "Filamentous algae" },
  diptera: { display: "Diptera" },
} as const satisfies Record<string, { code?: string; display: string; unit?: string }>;

export type CitizenIndicator = keyof typeof CITIZEN_INDICATORS;

export function indicatorCode(indicator: CitizenIndicator): string {
  const entry = CITIZEN_INDICATORS[indicator];
  return "code" in entry ? entry.code : indicator;
}
