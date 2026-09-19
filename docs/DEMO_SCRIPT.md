# Demo video script (3–5 minutes)

Target length: about 4 minutes. Record the screen at 1920×1080. Use a phone-sized browser window (Chrome DevTools device mode, iPhone 14 or similar) for the citizen part.

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
4. Put the reporter name "Maria (citizen scientist)" in the report form once so it is remembered.

## Script

### 1. Hook (0:00–0:20)
**Screen:** map of Crete with the stream sites.
**Say:** "Citizens notice when a stream turns green or starts to foam, often days before anyone gets sick. But that knowledge never reaches the clinics that will see the patients. Environmental data and health data live in separate systems with no shared standard. Stream-to-Clinic connects them with HL7 FHIR and the OneAquaHealth Implementation Guide."

### 2. Citizen report (0:20–1:20)
**Screen:** phone view.
- Report tab. Tap "Nearest to me", or pick "Almyros monitoring reach".
- Choose **Filamentous algae**, then **Abundant**. Add a photo. Send.
- Show the success screen and the link to the FHIR resource.
- Report again: **Water temperature 27 °C**. Send. The alert appears on the success screen.
**Say:** "A report takes under 30 seconds and works offline. Each one is stored as a FHIR Observation using the OneAquaHealth indicator profile. This second report completes a pattern: abundant algae, warm water and a dry week. The risk engine raised an algal-bloom alert right away."

### 3. Standards (1:20–2:05)
**Screen:** open the FHIR link in a new tab and show the Observation JSON. Point at `meta.profile` (`observation-indicators-oah`), the OAH code, UCUM units and `subject` → `Location/Loc-Almyros`.
Then show the GitHub Actions "Validate FHIR" run: 0 errors.
**Say:** "This is the same report on a public FHIR R4 server. It declares the OneAquaHealth profile, uses the OAH code system and UCUM units, and points to a LocationOah from the Implementation Guide. On every change, CI builds the OAH guide from source and runs the official HL7 validator on resources produced by our real code, so a mapping bug fails the build."

### 4. Risk engine (2:05–2:50)
**Screen:** map, with Almyros now red. Open the site panel, then the alert.
- Show the reasons and "How this alert was decided".
- Open the `DetectedIssue` JSON: evidence links to the two Observations.
**Say:** "The engine is rule-based and explainable on purpose. It checked recent reports, pulled rainfall from Open-Meteo, tested each condition, and wrote down every step. The result is a standard FHIR DetectedIssue whose evidence points to the citizen observations. A low-oxygen reading, by contrast, stays an environmental warning on the map; clinics are not alerted for that."

### 5. Clinic (2:50–3:35)
**Screen:** desktop, clinic view for "Almyros Primary Care Unit (demo)".
- The new alert is at the top. Open it: what to watch for, the reasons, the site.
- Show the `Communication` JSON: recipient is the clinic's Organization, and `about` is the DetectedIssue.
**Say:** "The clinic serving this stream gets a FHIR Communication. In plain language: watch for skin irritation and gastrointestinal symptoms after contact with stream water, and here is why. Any system that speaks FHIR can receive this, not only our app."

### 6. Scale and close (3:35–4:10)
**Screen:** README architecture diagram.
**Say:** "Everything is open standards and open source: Next.js, Fastify, HAPI FHIR and Postgres, deployed automatically. A FHIR Subscription means other OneAquaHealth tools can write observations and get the same assessment. Any city with streams and clinics can deploy it. A bloom spotted on Monday; nearby clinics warned on Monday, not after the first cases."

## After recording

- Remove the `WEATHER_OVERRIDE` line from `/srv/env/stream-to-clinic.env` and rerun the same `docker compose ... up -d api` command.
- Upload to YouTube (unlisted is fine) and add the link to [SUBMISSION.md](SUBMISSION.md) and to Devpost.
