// Data lineage for citizen reports. Every Observation we create gets a Provenance saying who
// reported it, which app assembled it and when it was recorded, so a clinic acting on an alert
// can trace the claim back to a person and a moment rather than to an anonymous row.
import { fhir } from "./fhir.js";

const PARTICIPANT_TYPE = "http://terminology.hl7.org/CodeSystem/provenance-participant-type";
const DATA_OPERATION = "http://terminology.hl7.org/CodeSystem/v3-DataOperation";
const APP = "Stream-to-Clinic (citizen report app)";

/** Targets are references such as "Observation/123"; the first one is the report itself. */
export function toProvenance(targets: string[], reporter: string, recorded: string): fhir4.Provenance {
  const agentType = (code: string, display: string) => ({ coding: [{ system: PARTICIPANT_TYPE, code, display }] });
  return {
    resourceType: "Provenance",
    target: targets.map((reference) => ({ reference })),
    recorded,
    activity: { coding: [{ system: DATA_OPERATION, code: "CREATE", display: "create" }] },
    agent: [
      // Citizen scientists are not registered users here, so the author is a display name only.
      { type: agentType("author", "Author"), who: { display: reporter } },
      { type: agentType("assembler", "Assembler"), who: { display: APP } },
    ],
  };
}

export async function recordProvenance(targets: string[], reporter: string): Promise<void> {
  await fhir.create(toProvenance(targets, reporter, new Date().toISOString()));
}
