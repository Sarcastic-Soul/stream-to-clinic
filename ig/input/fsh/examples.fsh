// One algal-bloom alert at the Almyros site, the message sent to its clinic and the clinic's reply.
// The API's real output is validated separately (validation/samples/generated).

Instance: example-algal-bloom-alert
InstanceOf: StcStreamRiskAlert
Title: "Algal bloom alert at Almyros"
Usage: #example
* identifier.system = $AlertId
* identifier.value = "Loc-Almyros:algal-bloom"
* status = #final
* code = $WaterHealthRisk#algal-bloom "Possible algal bloom"
* code.text = "Possible algal bloom"
* severity = #high
* identifiedPeriod.start = "2026-07-15T12:00:00Z"
* author.display = "Stream-to-Clinic risk engine"
* implicated = Reference(Location/Loc-Almyros) "Almyros monitoring reach"
* evidence[0].code.text = "Filamentous algae reported as abundant."
* evidence[0].detail = Reference(Observation/report-filamentousAlgae-abundant)
* evidence[1].code.text = "Water temperature 27.5 °C (threshold 25 °C)."
* evidence[1].detail = Reference(Observation/report-waterTemperature)
* evidence[2].code.text = "0.4 mm rain in the last 7 days (Open-Meteo)."
* detail = "Possible algal bloom at Almyros monitoring reach. Filamentous algae reported as abundant. Water temperature 27.5 °C (threshold 25 °C). 0.4 mm rain in the last 7 days (Open-Meteo). Demo heuristic, not clinical guidance."
* mitigation.action.text = "Skin irritation, rashes or gastrointestinal symptoms after contact with the stream water."

Instance: example-clinic-alert
InstanceOf: StcClinicAlert
Title: "Algal bloom alert sent to the Almyros clinic"
Usage: #example
* status = #completed
* category = $CommCategory#alert
* priority = #urgent
* subject = Reference(Group/cohort-Loc-Almyros)
* about = Reference(DetectedIssue/example-algal-bloom-alert)
* recipient = Reference(Organization/clinic-almyros) "Almyros Primary Care Unit (demo)"
* sender.display = "Stream-to-Clinic risk engine"
* sent = "2026-07-15T12:00:00Z"
* payload.contentString = "Possible algal bloom at Almyros monitoring reach (Almyros Stream). Watch for: skin irritation, rashes or gastrointestinal symptoms after contact with the stream water. Demo heuristic, not clinical guidance."

Instance: example-clinic-response
InstanceOf: StcClinicResponse
Title: "The Almyros clinic briefs its staff"
Usage: #example
* status = #completed
* category = $CommCategory#alert
* topic = $AlertResponse#staff-briefed "Clinic staff briefed"
* topic.text = "Clinic staff briefed"
* inResponseTo = Reference(Communication/example-clinic-alert)
* about = Reference(DetectedIssue/example-algal-bloom-alert)
* subject = Reference(Group/cohort-Loc-Almyros)
* sender = Reference(Organization/clinic-almyros) "Almyros Primary Care Unit (demo)"
* sent = "2026-07-15T14:30:00Z"
* received = "2026-07-15T14:30:00Z"
* payload.contentString = "Reception and triage briefed; advising patients to avoid contact with the water."
