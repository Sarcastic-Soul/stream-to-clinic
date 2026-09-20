const OAH_CANONICAL = "http://hl7.eu/fhir/ig/oah";

export const OAH_PROFILES = {
  observationIndicators: `${OAH_CANONICAL}/StructureDefinition/observation-indicators-oah`,
  observationHealthMeasure: `${OAH_CANONICAL}/StructureDefinition/observation-health-measure-oah`,
  location: `${OAH_CANONICAL}/StructureDefinition/location-oah`,
  group: `${OAH_CANONICAL}/StructureDefinition/group-oah`,
} as const;

export const OAH_CODE_SYSTEM = `${OAH_CANONICAL}/CodeSystem/temporarySystem-oah-eu`;
export const OAH_LOCATION_ID_SYSTEM = "https://oneaquahealth.eu/location-id";

// Our own terminology and identifier namespaces. The CodeSystems are seeded into HAPI,
// so these canonical URLs resolve on the public server.
const STC_CANONICAL = "https://oneaquahealth.duckdns.org/fhir";
export const PRESENCE_SYSTEM = `${STC_CANONICAL}/CodeSystem/presence`;
export const RISK_SYSTEM = `${STC_CANONICAL}/CodeSystem/water-health-risk`;
export const ALERT_ID_SYSTEM = `${STC_CANONICAL}/sid/alert`;
export const CLINIC_ID_SYSTEM = `${STC_CANONICAL}/sid/clinic`;
export const BUNDLE_ID_SYSTEM = `${STC_CANONICAL}/sid/site-bundle`;
export const ACK_SYSTEM = `${STC_CANONICAL}/CodeSystem/alert-response`;

export const UCUM = "http://unitsofmeasure.org";
// Standard HL7 tag for synthetic test data; applied to all seeded demo resources.
export const DEMO_TAG: fhir4.Coding = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
  code: "HTEST",
  display: "test health data",
};

export const PRESENCE_VALUES = ["absent", "present", "abundant"] as const;
export type Presence = (typeof PRESENCE_VALUES)[number];

interface QuantityIndicator {
  code?: string;
  display: string;
  kind: "quantity";
  unit: string;
  unitLabel: string;
  min: number;
  max: number;
}

interface PresenceIndicator {
  code?: string;
  display: string;
  kind: "presence";
}

// Citizen-measurable indicators. Codes come from the OAH temporary code system;
// the key doubles as the code unless `code` overrides it.
export const CITIZEN_INDICATORS = {
  waterTemperature: { display: "Water temperature", kind: "quantity", unit: "Cel", unitLabel: "°C", min: 0, max: 40 },
  pH: { display: "pH", kind: "quantity", unit: "[pH]", unitLabel: "pH", min: 0, max: 14 },
  dissolvedO2: { display: "Dissolved O2", kind: "quantity", unit: "mg/L", unitLabel: "mg/L", min: 0, max: 20 },
  conductivity: { display: "Conductivity", kind: "quantity", unit: "uS/cm", unitLabel: "µS/cm", min: 0, max: 20000 },
  foam: { display: "Foam/colour/smell", kind: "presence" },
  filamentousAlgae: { code: "filamentous-algae", display: "Filamentous algae", kind: "presence" },
  diptera: { display: "Diptera", kind: "presence" },
} as const satisfies Record<string, QuantityIndicator | PresenceIndicator>;

export type CitizenIndicator = keyof typeof CITIZEN_INDICATORS;

export function isCitizenIndicator(id: string): id is CitizenIndicator {
  return Object.hasOwn(CITIZEN_INDICATORS, id);
}

export function indicatorCode(indicator: CitizenIndicator): string {
  const entry = CITIZEN_INDICATORS[indicator];
  return "code" in entry ? entry.code : indicator;
}

export function indicatorFromCode(code: string | undefined): CitizenIndicator | undefined {
  return (Object.keys(CITIZEN_INDICATORS) as CitizenIndicator[]).find((id) => indicatorCode(id) === code);
}

// The `Indicator` list served by GET /indicators.
export function indicatorList() {
  return Object.entries(CITIZEN_INDICATORS).map(([id, { display, kind, ...rest }]) => ({
    id,
    display,
    kind,
    ...("unit" in rest ? { unit: rest.unit, unitLabel: rest.unitLabel, min: rest.min, max: rest.max } : {}),
  }));
}

// OAH health-measure codes used for the seeded district baselines.
export const HEALTH_MEASURES = {
  gastrointestinal: "% of people with Cases of Gastrointestinal diseases",
  campylobacter: "% of people with Campylobacter",
} as const;
