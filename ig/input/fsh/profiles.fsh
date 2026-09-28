// Profiles for what the OneAquaHealth IG does not cover: the alert raised from citizen reports, the
// messages it sends to clinics, a clinic's reply, the model-drafted advisory and report lineage.
// Each one constrains what the API actually writes (api/src/alerts.ts, advisory.ts, provenance.ts),
// and CI validates the API's real output against them (validation/).

RuleSet: Draft
* ^status = #draft
* ^experimental = true

Profile: StcStreamRiskAlert
Parent: DetectedIssue
Id: stc-stream-risk-alert
Title: "Stream risk alert"
Description: "A water-related health risk at a stream site, raised by the Stream-to-Clinic rule engine from citizen observations (ObservationIndicatorsOah) and weather. One active alert exists per site and risk; it closes when identifiedPeriod.end is set."
* insert Draft
* identifier 1..1 MS
* identifier.system 1..1
* identifier.system = $AlertId (exactly)
* identifier.value 1..1
* identifier.value ^short = "<site id>:<risk code>, unique among active alerts"
* status = #final
* code 1..1 MS
* code from WaterHealthRiskVS (required)
* code.text 1..1
* severity 1..1 MS
* identified[x] 1..1 MS
* identified[x] only Period
* identifiedPeriod.start 1..1
* identifiedPeriod.end ^short = "Set when a later evaluation no longer meets the rule: the alert is closed"
* author 1..1
* author.display 1..1
* implicated 1..1 MS
* implicated only Reference($LocationOah)
* implicated ^short = "The stream site at risk"
* evidence 1..* MS
* evidence ^short = "One entry per condition of the rule that was met"
* evidence.code 1..1
* evidence.code.text 1..1
* evidence.code.text ^short = "The condition in plain language"
* evidence.detail only Reference(Observation)
* evidence.detail ^short = "The citizen observations behind the condition, if any"
* detail 1..1 MS
* detail ^short = "Summary line, then the numbered steps of the engine's decision"
* mitigation 0..1 MS
* mitigation ^short = "What clinicians should watch for; absent for environment-only risks"
* mitigation.action.text 1..1

Profile: StcClinicAlert
Parent: Communication
Id: stc-clinic-alert
Title: "Clinic alert"
Description: "A stream risk alert sent to a clinic that serves the affected stream site. Sent once per clinic when the alert is raised."
* insert Draft
* status = #completed
* category 1..1 MS
* category = $CommCategory#alert
* priority 1..1 MS
* subject 1..1 MS
* subject only Reference($GroupOah)
* subject ^short = "The district cohort living near the stream site"
* about 1..1 MS
* about only Reference(StcStreamRiskAlert)
* recipient 1..1 MS
* recipient only Reference(Organization)
* recipient.reference 1..1
* recipient.display 1..1
* sender 1..1
* sender.display 1..1
* sent 1..1 MS
* inResponseTo 0..0
* topic 0..0
* payload 1..1 MS
* payload.content[x] only string

Profile: StcClinicResponse
Parent: Communication
Id: stc-clinic-response
Title: "Clinic response to an alert"
Description: "What a notified clinic did about a stream risk alert: a reply to the clinic alert it received, with a coded action, so the environmental side can see which warnings led to action."
* insert Draft
* status = #completed
* category 1..1 MS
* category = $CommCategory#alert
* topic 1..1 MS
* topic from AlertResponseVS (required)
* topic ^short = "What the clinic did"
* inResponseTo 1..1 MS
* inResponseTo only Reference(StcClinicAlert)
* about 1..1 MS
* about only Reference(StcStreamRiskAlert)
* subject only Reference($GroupOah)
* sender 1..1 MS
* sender only Reference(Organization)
* sender.reference 1..1
* sent 1..1 MS
* received 1..1
* payload 1..1 MS
* payload.content[x] only string
* payload ^short = "The clinic's note, or the action's display text"

Profile: StcAdvisorDevice
Parent: Device
Id: stc-advisor-device
Title: "Advisory model"
Description: "The language model that drafts plain-language advisories from rule-engine alerts, as a Device so its output can be attributed to it. It never raises or changes an alert."
* insert Draft
* status = #active
* deviceName 1..* MS
* deviceName.type = #model-name
* type 1..1 MS
* type.text 1..1

Profile: StcClinicAdvisory
Parent: Communication
Id: stc-clinic-advisory
Title: "Model-drafted clinic advisory"
Description: "A stream risk alert rewritten in plain language for clinic staff by the advisory model. The sender is the model's Device, and a StcAdvisoryProvenance names it as author, so machine-written text is marked as such wherever it is read."
* insert Draft
* status = #completed
* category 1..1 MS
* category = $CommCategory#instruction
* subject 1..1 MS
* subject only Reference($GroupOah)
* about 1..1 MS
* about only Reference(StcStreamRiskAlert)
* sender 1..1 MS
* sender only Reference(StcAdvisorDevice)
* sender.reference 1..1
* sender.display ^short = "The model name"
* sent 1..1 MS
* payload 1..1 MS
* payload.content[x] only string

Profile: StcReportProvenance
Parent: Provenance
Id: stc-report-provenance
Title: "Citizen report provenance"
Description: "Who reported a citizen observation, which app assembled it and when it was recorded. Written for every report, so an alert's evidence traces back to a person and a moment."
* insert Draft
* target 1..* MS
* target only Reference($ObservationIndicatorsOah or Media)
* target ^short = "The citizen observation, then its photo (if any)"
* activity 1..1 MS
* activity = $DataOperation#CREATE
* agent ^slicing.discriminator.type = #pattern
* agent ^slicing.discriminator.path = "type"
* agent ^slicing.rules = #open
* agent contains author 1..1 MS and assembler 1..1 MS
* agent[author].type 1..1
* agent[author].type = $ParticipantType#author
* agent[author].who.display 1..1
* agent[author].who ^short = "The citizen, by display name (reporters are not registered users)"
* agent[assembler].type 1..1
* agent[assembler].type = $ParticipantType#assembler
* agent[assembler].who.display 1..1

Profile: StcAdvisoryProvenance
Parent: Provenance
Id: stc-advisory-provenance
Title: "Advisory provenance"
Description: "Lineage for a model-drafted advisory: the advisory model is the author and the alert it was derived from is the source."
* insert Draft
* target 1..1 MS
* target only Reference(StcClinicAdvisory)
* activity 1..1 MS
* activity = $DataOperation#CREATE
* agent ^slicing.discriminator.type = #pattern
* agent ^slicing.discriminator.path = "type"
* agent ^slicing.rules = #open
* agent contains author 1..1 MS and assembler 1..1 MS
* agent[author].type 1..1
* agent[author].type = $ParticipantType#author
* agent[author].who only Reference(StcAdvisorDevice)
* agent[author].who.reference 1..1
* agent[assembler].type 1..1
* agent[assembler].type = $ParticipantType#assembler
* agent[assembler].who.display 1..1
* entity 1..1 MS
* entity.role = #source
* entity.what only Reference(StcStreamRiskAlert)
