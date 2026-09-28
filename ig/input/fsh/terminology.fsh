// Codes must match the API: PRESENCE_VALUES (api/src/oah.ts), RISKS (api/src/rules.ts) and
// ACK_ACTIONS (api/src/alerts.ts). api/test/definitions.test.ts checks that they do.

CodeSystem: Presence
Id: presence
Title: "Presence of a visual stream indicator"
Description: "How much of a visual indicator (foam, filamentous algae, diptera larvae) a citizen saw at a stream site."
* ^status = #active
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #absent "Absent"
* #present "Present"
* #abundant "Abundant"

ValueSet: PresenceVS
Id: presence
Title: "Presence of a visual stream indicator"
Description: "All codes from the Presence code system."
* ^status = #active
* ^experimental = true
* include codes from system $Presence

CodeSystem: WaterHealthRisk
Id: water-health-risk
Title: "Water-related health risks raised by Stream-to-Clinic"
Description: "The risks the Stream-to-Clinic rule engine can raise for a stream site."
* ^status = #active
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #algal-bloom "Possible algal bloom"
* #sewage-overflow "Possible sewage overflow"
* #mosquito-breeding "Mosquito breeding conditions"
* #low-oxygen "Low dissolved oxygen"

ValueSet: WaterHealthRiskVS
Id: water-health-risk
Title: "Water-related health risks raised by Stream-to-Clinic"
Description: "All codes from the WaterHealthRisk code system."
* ^status = #active
* ^experimental = true
* include codes from system $WaterHealthRisk

CodeSystem: AlertResponse
Id: alert-response
Title: "What a clinic did about an alert"
Description: "The action a notified clinic reports back when it answers a Stream-to-Clinic alert."
* ^status = #active
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #staff-briefed "Clinic staff briefed"
* #patients-advised "Patients advised about the water"
* #authority-notified "Local health authority notified"
* #no-action "Noted, no action needed"

ValueSet: AlertResponseVS
Id: alert-response
Title: "What a clinic did about an alert"
Description: "All codes from the AlertResponse code system."
* ^status = #active
* ^experimental = true
* include codes from system $AlertResponse
