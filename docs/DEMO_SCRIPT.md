# Demo video script (3–5 minutes)

Target length: about 4 minutes 30. Record the screen at 1920×1080. Use a phone-sized browser window (Chrome DevTools device mode, iPhone 14 or similar) for the citizen part.

## The ten lines that must be said

Judging is weighted: Impact and alignment 30%, Innovation 20%, Technical implementation 20%, Usability 15%, Feasibility and scalability 15%. Everything below exists to land these ten points. If a take runs long, cut demo steps, never these.

1. **The gap.** "Citizens see the stream change days before anyone gets sick, but that knowledge never reaches the clinic that treats them. Environmental data and health data have no shared standard."
2. **We did not invent a format.** "Every resource uses the OneAquaHealth Implementation Guide — its profiles, its code system — on real OneAquaHealth pilot sites in Crete and Campania."
3. **Conformance is proven, not claimed.** "On every commit, CI builds the OAH guide from source and runs the official HL7 validator against resources produced by our real API code. Zero errors."
4. **No integration project.** "Any clinic already running FHIR consumes these alerts on day one. No adapter, no mapping workshop, no six-month integration per site."
5. **Explainable by design.** "The risk engine is rules plus weather, and it writes down every step it took. The DetectedIssue evidence links straight back to the citizen observations that triggered it."
6. **AI that writes, never decides.** "A language model rewrites the alert as a notice for the clinic desk — from the engine's own reasons, nothing else. It never sets a risk level. And the draft is stored as a FHIR Communication sent by a Device, with a Provenance naming that model as the author, so machine-written text is marked as such wherever it is read."
7. **The loop closes.** "The clinic acknowledges the alert, and that acknowledgement is itself a FHIR resource — so the environmental side learns which warnings led to action."
8. **One report becomes a pattern.** "The same reports roll up into a four-week catchment view: which stream is warming, losing oxygen or rising in conductivity, beside the district's own disease baseline — so an authority can act before a threshold is crossed, not after."
9. **Deployable now.** "Open source, open standards, running on free and open infrastructure. Any city with streams and clinics can deploy this, and the OneAquaHealth consortium could point it at their own sites tomorrow."
10. **The close.** "A bloom spotted on Monday; nearby clinics warned on Monday, not after the first cases."

Say "OneAquaHealth Implementation Guide" in full at least once, early. Two of the ten judges coordinate that project and one is an HL7 Fellow.

## Before recording

1. **Make the bloom rule fire.** It needs 5 mm of rain or less in 7 days at the site. Check real weather first:
   `curl -s "https://api.open-meteo.com/v1/forecast?latitude=35.334&longitude=25.048&daily=precipitation_sum&past_days=7&forecast_days=1"`
   If the week was wet, turn on the demo weather override on the host for the recording, and turn it off afterwards:
   ```bash
   ssh hackathon-box
   echo 'WEATHER_OVERRIDE={"rain24h":0,"rain7d":1.2}' | sudo tee -a /srv/env/stream-to-clinic.env
   cd /srv/stream-to-clinic && sudo docker compose -f deploy/compose.yml --env-file /srv/env/stream-to-clinic.env up -d api
   ```
   Alerts made this way say "demo weather override" in their reasons. Say so in the video; do not hide it.
2. Make sure the Almyros site has no active algal-bloom alert (open it on the map). If one is active from an earlier take, report cool water (for example 18 °C) to close it.
3. Open these tabs:
   - Tab 1: https://stream-to-clinic.vercel.app (phone size)
   - Tab 2: https://stream-to-clinic.vercel.app/clinic?clinic=clinic-almyros (desktop size)
   - Tab 3: the FHIR endpoint, for the JSON views
   - Tab 4: the GitHub Actions "Validate FHIR" run, already green
4. Put the reporter name "Maria (citizen scientist)" in the report form once so it is remembered.
5. **Check the advisory model is configured.** `curl -s https://oneaquahealth.duckdns.org/health` should report `"advisory": true`. If it says `false`, the key is missing from `/srv/env/stream-to-clinic.env` — either add it and restart the API, or cut beat 6 and its must-say line from the take.
6. Draft the advisory once before recording, on an alert you will *not* use in the video. The first call takes a few seconds; on the alert you demo, the panel should still be unused so the draft appears live.

## Script

### 1. Hook (0:00–0:25)
**Screen:** map of Crete with the stream sites, then zoom to Almyros.
**Say:** "Citizens notice when a stream turns green or starts to foam — often days before anyone gets sick. But that knowledge never reaches the clinics that will see the patients, because environmental data and health data live in separate systems with no shared standard. Stream-to-Clinic connects them using HL7 FHIR and the OneAquaHealth Implementation Guide. These are real OneAquaHealth pilot sites in Crete and Campania."

*(Must-say 1 and 2.)*

### 2. Citizen report (0:25–1:15)
**Screen:** phone view.
- Report tab. Tap "Nearest to me", or pick "Almyros monitoring reach".
- Choose **Filamentous algae**, then **Abundant**. Add a photo. Send.
- Show the success screen and the link to the FHIR resource.
- Report again: **Water temperature 27 °C**. Send. The alert appears on the success screen.
**Say:** "A report takes under thirty seconds and works offline — it queues on the phone and syncs later, because riverbanks have bad signal. Each report becomes a FHIR Observation on the OneAquaHealth indicator profile, with a Provenance record naming who reported it and when. This second report completes a pattern: abundant algae, warm water, a dry week. The risk engine raised an algal-bloom alert immediately."

### 3. Standards (1:15–2:00)
**Screen:** the Observation JSON. Point at `meta.profile` (`observation-indicators-oah`), the OAH code, UCUM units, `subject` → `Location/Loc-Almyros`. Then the green "Validate FHIR" CI run.
**Say:** "Here is that report on a public FHIR R4 server. It declares the OneAquaHealth profile, uses the OAH code system and UCUM units, and points at a LocationOah from the guide itself — we did not invent a format. And conformance here is proven, not claimed: on every commit, CI builds the OAH guide from source and runs the official HL7 validator against resources produced by our real API code. Zero errors. That matters, because it means any clinic already running FHIR consumes these alerts on day one — no adapter, no mapping workshop, no six-month integration project per site."

*(Must-say 2, 3 and 4. This is the highest-value 45 seconds in the video — do not rush it.)*

### 4. Risk engine (2:00–2:40)
**Screen:** map, Almyros now red. Open the site panel, then the alert. Show the reasons and "How this alert was decided". Open the `DetectedIssue` JSON: evidence links to the two Observations.
**Say:** "The engine is rule-based and explainable on purpose — no black box telling a clinician to trust it. It checked recent reports, pulled rainfall from Open-Meteo, tested each condition and wrote down every step. The result is a standard FHIR DetectedIssue whose evidence points straight back at the citizen observations. Note what does not happen: a low-oxygen reading stays an environmental warning on the map. Clinics are not alerted for that, because crying wolf is how early-warning systems die."

*(Must-say 5. The last sentence is a credibility line — it shows restraint a judge can recognise.)*

### 5. Clinic, and closing the loop (2:40–3:30)
**Screen:** desktop, clinic view for "Almyros Primary Care Unit (demo)".
- The new alert is at the top. Open it: what to watch for, the reasons, the site.
- Show the `Communication` JSON: recipient is the clinic's Organization, `about` is the DetectedIssue.
- Click **Acknowledge**, choose an action, submit. Show the acknowledgement appearing on the alert.
- Show the response `Communication` JSON: `inResponseTo` the original, `sender` the clinic.
**Say:** "The clinic serving this stream receives a FHIR Communication. In plain language: watch for skin irritation and gastrointestinal symptoms after contact with stream water — and here is exactly why. Any system that speaks FHIR can receive this, not only our app. And the loop closes: when the clinic acknowledges, that acknowledgement is itself a FHIR resource, linked to the original message, so the environmental side learns which warnings actually led to action. That is the One Health loop, end to end, in standard resources."

*(Must-say 7.)*

### 6. The model that only writes (3:30–3:50)
**Screen:** same alert page, "Notice for the clinic desk". Click **Draft the notice**; read the first line of the result. Open the `Communication` JSON: `sender` is `Device/stc-ai-advisor`; then its `Provenance`, agent type `author`.
**Say:** "There is AI here, and it is kept in its place. The model is given this alert's own reasons and nothing else, and asked to rewrite them for whoever is on the desk. It never sets or changes a risk level — the rules do that. And look at how the draft is stored: a FHIR Communication sent by a Device, with a Provenance naming that model as the author. Machine-written text stays marked as machine-written, wherever it is read next."

*(Must-say 6. This is the Innovation point, and the governance point HL7 people listen for — the provenance matters more than the prose.)*

### 7. From one report to a pattern (3:50–4:10)
**Screen:** the Trends page, 28-day window. Point at the Giofyros lower reach: dissolved oxygen falling, water temperature rising, "Worth watching". Then the region rollup and the answered-alerts count.
**Say:** "One report tells a clinic what to watch for today. Weeks of reports tell a health authority where to look first. This reach is warming and losing oxygen — that is visible here weeks before it crosses a threshold, next to the district's own disease baseline. And the region line shows how many alerts the clinics actually answered, which is the number a public health service would be judged on."

*(Must-say 8.)*

### 8. Scale and close (4:10–4:35)
**Screen:** README architecture diagram, then the map.
**Say:** "Everything here is open standards and open source: Next.js, Fastify, HAPI FHIR and Postgres, deployed automatically, running on free and open infrastructure. A FHIR Subscription means other OneAquaHealth tools can write observations into the same server and get the same assessment back — we are a participant in their ecosystem, not a silo beside it. Any city with streams and clinics can deploy this, and the OneAquaHealth consortium could point it at their own sites tomorrow. A bloom spotted on Monday; nearby clinics warned on Monday, not after the first cases."

*(Must-say 9 and 10.)*

## Delivery notes

- **Lead with the person, not the stack.** The first twenty seconds decide the Impact score, and Impact is 30%. No architecture before 1:15.
- **Show, then name.** Click first, then say what the resource is called. Judges reading JSON while you talk over it retain neither.
- **Say the numbers out loud** where they exist: under thirty seconds to report, zero validator errors, four sites, four clinics, two countries.
- **Do not call the model "the AI" as if it were the product.** It gets twenty seconds, after the rules have already decided; the sentence that matters is "it never sets a risk level".
- **Do not apologise** for demo data or the weather override. State it once, plainly, and move on; a flagged limitation reads as rigour, a mumbled one reads as a gap.
- Record in one take per section and cut between them. A clean 4:20 beats a rambling 4:59. If a section has to go, cut 7 (trends) before 6 (the model), and say the trend line over the map instead.

## After recording

- Remove the `WEATHER_OVERRIDE` line from `/srv/env/stream-to-clinic.env` and rerun the same `docker compose ... up -d api` command.
- Upload to YouTube (unlisted is fine) and add the link to [SUBMISSION.md](SUBMISSION.md) and to Devpost.
