# Demo video script

The video is made by the demo-video pipeline (`~/Code/Hackathons/demo-video-pipeline`), not recorded by hand. It drives the live site in headless Chromium with Playwright, reads the narration with a text-to-speech voice, and adds a drawn hook, slides and an end card. The plan that produces it is `output/stream-to-clinic/video.json` in the pipeline folder. The rules ask for 3 to 5 minutes; the video is 3 minutes 21.

## What the video must land

Judging is weighted: Impact and alignment 30%, Innovation 20%, Technical implementation 20%, Usability 15%, Feasibility and scalability 15%. Each point below has a beat in the video.

| Point | Where |
|---|---|
| The gap: citizens see the change days before anyone gets sick, and the clinic never hears | Hook |
| We did not invent a format: real OAH pilot sites and the OAH Implementation Guide | Demo: pilot sites, standard FHIR; slide 2 |
| Report to clinic in about a second | Demo: live loop |
| The citizen sees what their report did | Demo: follow the report |
| Conformance is proven: HL7 validator in CI, 0 errors | Slides 2 and 3 |
| Fits a clinic's own systems: SMART on FHIR launch from an EHR | Demo: SMART launch |
| Explainable by design: every alert lists its reasons and evidence | Demo: explained |
| AI that writes, never decides, and is marked as machine-written | Demo: advisory; ask the data |
| The loop closes in standard resources, with a signed reply | Demo: signed reply; slide 1 |
| One report becomes a pattern, and low oxygen alone never alerts clinics | Demo: trends |
| Open source, open standards, deployable now | Slide 4, end card |

## Structure

1. **Hook (about 20 s).** Maria walks by a stream near Heraklion, sees it turn green, posts about it, and nobody in charge of health sees it. Three days later the clinic sees rashes and stomach bugs and has no idea why.
2. **Title.** "Stream-to-Clinic: stream reports become clinic warnings, in FHIR."
3. **Live demo (about 2 minutes), in this order:**
   1. **Pilot sites.** The map with the OAH sites in Crete and Campania, coloured by risk.
   2. **Report.** The Live loop page: Maria's phone on the left, the clinic's phone on the right. She picks filamentous algae, Abundant, and types her name.
   3. **Clinic warned.** She sends it. The clinic phone shows the algal-bloom banner with no refresh, and the timer shows the time from report to clinic.
   4. **Follow the report.** Her report's page: stored, checked, the alert it raised and each clinic that was told.
   5. **Standard FHIR.** The Observation on the public FHIR server, with the OAH profile, code system, UCUM units and Location.
   6. **SMART launch.** On the clinic page, "Open from the demo EHR" launches the clinic view with SMART on FHIR; it signs the doctor in with her clinic as the context.
   7. **Explained.** The alert's reasons and the step-by-step account of the decision.
   8. **AI, kept in its place.** "Draft the notice": the model rewrites the alert for the clinic desk, stored as sent by a `Device` with a `Provenance`.
   9. **Signed reply.** "Patients advised about the water", Send response; the reply shows "Signed by" with its `Provenance`.
   10. **Trends.** The Giofyros lower reach is warming and losing oxygen; low oxygen alone never alerts clinics.
   11. **Ask the data.** The agent answers "Which stream sites have an active alert, and why?" and lists the FHIR searches it ran.
4. **Slides.** How it works (report, rules plus weather, `DetectedIssue`, `Communication`, signed reply); built on the standard (OAH IG, our FSH profiles, HL7 validator in CI, SMART App Launch 2.0, MCP server); the numbers (0 validator errors, 4 OAH pilot sites, 3 languages); how it is wired.
5. **Outro.** Maria's report now reaches the clinic in about a second. End card with the live URL and QR codes for the site and the repository.

The narration never quotes live numbers such as the loop time; the recording shows them.

## Recording it again

Every step runs against the live site, so the data has to be in a known state first.

1. **Weather.** The bloom rule needs 5 mm of rain or less in 7 days. If the week was wet, set the demo weather override on the host and restart the API:
   ```bash
   echo 'WEATHER_OVERRIDE={"rain24h":0,"rain7d":1.2}' | sudo tee -a /srv/env/stream-to-clinic.env
   cd /srv/stream-to-clinic && sudo docker compose -f deploy/compose.yml --env-file /srv/env/stream-to-clinic.env up -d api
   ```
   Alerts made this way say "demo weather override" in their reasons, and the video shows that line as it is.
2. **Almyros reset.** The plan's setup step posts three reports to Almyros before recording (filamentous algae absent, mosquito larvae absent, water 27.4 °C). That closes any bloom alert left from an earlier take and leaves warm water in place, so Maria's single "Abundant" report raises a fresh alert.
3. **Agent and advisory.** Both call Amazon Bedrock with the host's IAM role; no key is needed. `BEDROCK_MODEL` lists the models in order (default GLM 4.7 Flash, then Ministral 3 14B), and a throttled model hands the request to the next one. Together they allow 100 model requests a day (`LLM_DAILY_LIMIT`), and a restart of the API resets the count.
4. **Record, check, build:**
   ```bash
   PIPELINE=~/Code/Hackathons/demo-video-pipeline
   uv run --project "$PIPELINE" python3 "$PIPELINE/run_pipeline.py" check "$PIPELINE/output/stream-to-clinic/video.json"
   uv run --project "$PIPELINE" python3 "$PIPELINE/run_pipeline.py" finish stream-to-clinic --plan "$PIPELINE/output/stream-to-clinic/video.json" --only record
   uv run --project "$PIPELINE" python3 "$PIPELINE/run_pipeline.py" finish stream-to-clinic --plan "$PIPELINE/output/stream-to-clinic/video.json"
   ```
   `--only record` writes `stage3/preview.png` with one frame per scene; check it before the full build. The video is `output/stream-to-clinic/final_demo.mp4`, with the YouTube text in `youtube.txt`.

## After recording

- Remove the `WEATHER_OVERRIDE` line from `/srv/env/stream-to-clinic.env` and rerun the same `docker compose ... up -d api` command.
- Post a cool-water report (for example 18 °C) at Almyros so the demo alert does not stay open.
- Upload to YouTube (unlisted is fine) and add the link to [SUBMISSION.md](SUBMISSION.md) and to Devpost.
