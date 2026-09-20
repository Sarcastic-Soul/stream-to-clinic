# Stream-to-Clinic: Project Plan and Progress

Last updated: 2026-09-20
Submission deadline: **Sep 30, 2026, 9:00 PM PDT** (Oct 1, 9:30 AM IST). Target: submit by Sep 30 evening IST.

Tech stack, infrastructure and deployment are described in [ARCHITECTURE.md](ARCHITECTURE.md). Hackathon rules, dates and judges are in [../HACKATHON_DETAILS.md](../HACKATHON_DETAILS.md).

## Current status

- **Done:** Stages 0–7, and the Stage 8 documents (README, SUBMISSION.md, DEMO_SCRIPT.md). Installable PWA with offline report queue, report photos (`Media` + `Binary`), alert narrative, FHIR rest-hook Subscription, accessibility pass, code-review fixes. Everything is live.
- **Validation:** CI checks resources from the real API code against the OAH IG: 0 errors.
- **Next (user):** record the demo video from [DEMO_SCRIPT.md](DEMO_SCRIPT.md), add its link to [SUBMISSION.md](SUBMISSION.md), submit on Devpost before Sep 30, 9:00 PM PDT.
- **Also done:** site FHIR `Bundle` export, a `/standards` page for judges, a UI pass on the map, themes and colours, `Provenance` lineage on every citizen report, clinic acknowledgements that close the One Health loop, and Greek/Italian for the citizen surface (Stage 7).
- **Optional if time remains:** SMART on FHIR launch; review leftovers: alert reason dates in UTC, 200-item cap on alert/communication lists.
- **Live:** frontend https://stream-to-clinic.vercel.app · API https://oneaquahealth.duckdns.org · FHIR https://oneaquahealth.duckdns.org/fhir/metadata
- **Demo note:** the algal-bloom rule needs a dry week. For the video, the API accepts an optional `WEATHER_OVERRIDE` env var (e.g. `{"rain24h":0,"rain7d":1.2}`); alert reasons then say "demo weather override". Production uses real Open-Meteo weather.

Keep this section and the stage checkboxes below up to date as work lands.

## 1. Goal

Finish in the top 5 of the OneAquaHealth IEEE Global Hackathon (prizes are overall, not per track).

We enter **Track 7 — Digital Health Standards** ("FHIR models, AI agents, and integration frameworks"), and borrow from Track 6 (alerts) and Track 2 (dashboards) to show the full One Health loop.

## 2. Problem and pitch

Citizens already observe urban streams (algae, foam, smell, dead fish, mosquitoes), and OneAquaHealth has a FHIR Implementation Guide for environmental and health indicators. But what citizens observe never reaches the people who treat the resulting illness. Environmental and health data live in separate systems with no shared standard.

**Stream-to-Clinic** turns a citizen's stream report into standard FHIR resources (using the OneAquaHealth IG profiles), combines it with weather data to spot health risks, and sends a FHIR alert to the clinics serving that neighbourhood.

One-line pitch: *"A bloom spotted on Monday; nearby clinics warned on Tuesday, not after the first ER cases."*

## 3. Users

| User | What they do | What they get |
|---|---|---|
| Citizen scientist | Reports a stream observation in under 30 seconds | Sees their report on the map; knows it mattered |
| Public health officer | Watches the map and risk alerts | Early warning per stream and district |
| Clinician / clinic | Receives alerts for its area | What to watch for (e.g. gastrointestinal cases), and why |
| Ecologist / OAH researcher | Browses the FHIR server | Standardised, reusable data (FAIR) |

## 4. Scope

### Must have (MVP)
1. Seed data: stream sites, clinics, district cohorts, baseline health data.
2. Citizen report form (mobile-first).
3. Map dashboard with per-site details.
4. Rule-based, explainable risk engine using observations plus Open-Meteo weather.
5. FHIR alerts: `DetectedIssue` plus `Communication` to affected clinics.
6. Clinician view with the reasoning in plain language.
7. Public read-only FHIR endpoint so judges can inspect real resources.
8. Profile validation against the OAH IG in CI.

### Should have (after the Sep 24 checkpoint, if on track)
- Installable PWA with an offline report queue.
- Photo attachment on reports (FHIR `Media` + `Binary`).
- Alert "agent" narrative: the risk engine explains its decision step by step (matches the "AI agents" wording in Track 7).
- FHIR Subscription (rest-hook) so new observations trigger the risk engine the standard way.
- Accessibility pass (contrast, labels, keyboard, screen reader).

### Stretch
- In-browser photo pre-tagging with CLIP (`transformers.js`), confirmed by the citizen.
- SMART on FHIR launch for the clinician view.
- [x] Export a site's data as a FHIR `Bundle` (`GET /sites/:id/bundle`, download link in the site panel).
- [x] Standards page (`/standards`) for judges: FHIR mapping, live example resources, conformance, Subscription integration.

### Out of scope
- User accounts and login (reports carry a display name only).
- Native mobile apps.
- Machine-learning prediction models (rules are explainable and defensible in the time available).
- Real patient data. All health data is synthetic or aggregate, as in the OAH IG examples.
- Paid services of any kind.

## 5. Stages

Each stage lists what it delivers and when it counts as done. Tick items as they land.

### Stage 0: Infrastructure and scaffold ✅ (Sep 19)
- [x] AWS: IAM user, budget alerts, credit-expiry reminders
- [x] EC2 host with Docker, Caddy, swap, SSM access, self-terminate on Oct 29
- [x] Domain and HTTPS (`oneaquahealth.duckdns.org`)
- [x] Repo scaffold: `web/`, `api/`, `fhir/`, `deploy/`
- [x] HAPI FHIR R4 + Postgres running behind Caddy; `/fhir` public read-only
- [x] API: `/health`, `POST /reports` mapping to `ObservationIndicatorsOah`
- [x] CI (typecheck, lint, build) and automatic backend deploy (OIDC → SSM)
- [x] Frontend on Vercel, CORS configured

### Stage 1: Data foundation ✅ (Sep 19)
Sites come from the OAH IG examples only (European OAH sites; no other regions).
- [x] Stream sites as `LocationOah`: Almyros, Giofyros (Crete, Greece) and Benevento (Italy) sites from the IG, with coordinates
- [x] Clinics as `Organization`, linked to the sites they serve
- [x] District cohorts as `GroupOah`
- [x] Baseline district health data as `ObservationHealthMeasureOah` (e.g. gastrointestinal prevalence), modelled on the IG's disease-prevalence example
- [x] Idempotent seed script (conditional create/update, safe to rerun), run on deploy
- **Done when:** `/fhir/Location` returns the sites, and `POST /reports` for a seeded site returns 201.

### Stage 2: Citizen reporting ✅ (Sep 19)
- [x] `GET /sites` in the API for the frontend
- [x] Report page: pick a site (list or nearest by GPS), indicator, value, optional note
- [x] Clear success state with a link to the created FHIR resource
- **Done when:** a report submitted from a phone shows up in `/fhir/Observation`.

### Stage 3: Map dashboard ✅ (Sep 19)
- [x] MapLibre + OpenFreeMap map with all sites
- [x] Site panel: latest observations, simple trend chart
- [x] Sites coloured by risk level
- **Done when:** the map shows every seeded site with its latest readings.

### Stage 4: Risk engine and alerts ✅ (Sep 19)
- [x] Open-Meteo client (last 7 days rainfall and temperature per site)
- [x] Rules from section 7, with reasons recorded for every decision
- [x] On a triggered rule: create `DetectedIssue` (evidence → triggering Observations) and `Communication` to the site's clinics
- [x] Re-evaluate a site whenever a new report arrives; avoid duplicate open alerts
- **Done when:** submitting the demo scenario (algae + warm water + dry week) produces a `DetectedIssue` and a `Communication`.

### Stage 5: Clinician view ✅ (Sep 19)
- [x] Choose a clinic; list its alerts, newest first
- [x] Alert detail: risk, affected site, evidence, what to watch for, in plain language
- **Checkpoint (Sep 24):** all must-haves except validation are working. Should-haves start only after this.

### Stage 6: Standards validation ✅ (Sep 19)
- [x] Build the OAH IG from source with SUSHI (pinned commit)
- [x] CI job: run `validator_cli` on sample resources produced by the API mapping
- [x] Validation badge and summary in the README
- **Done when:** CI fails if a mapping produces a resource that does not conform to the OAH profile.

### Stage 7: Polish and should-haves ✅ (Sep 20)
- [x] PWA manifest, installability, offline report queue
- [x] Accessibility pass (axe: 0 violations on all pages, light and dark)
- [x] Should-haves in order: alert narrative, photos, FHIR Subscription
- [x] Realistic demo dataset (refreshed daily) and bug fixing (code review: pH label, stale alerts, closed-alert status, clock skew, photo CORS)
- [x] Theme toggle: light, dark or follow the system, applied before the first paint
- [x] Map pass: colourful basemap (water and vegetation kept), place labels in one language, quieter country labels, clustering so nearby sites stop hiding each other, named markers, risk-count legend, fit-all control, two-finger gestures on phones
- [x] Colour pass: soft water-tinted page background with white cards, so the app reads as welcoming rather than flat grey
- [x] Greek and Italian for the citizen surface (report flow, navigation, map sidebar), with a language toggle; clinician pages stay English
- [x] `Provenance` for every citizen report: who reported it, which app assembled it, when it was recorded
- [x] Closing the loop: a notified clinic answers an alert (`POST /alerts/:id/acknowledge`), stored as a FHIR `Communication` with `inResponseTo`, shown on the alert and marked "Answered" in the clinic list

### Stage 8: Submission (Sep 28–30)
- [x] README: architecture diagram, screenshots, one-command setup
- [x] Track alignment statement (in [SUBMISSION.md](SUBMISSION.md))
- [x] Project description: problem, solution, target users, expected impact on ecosystem and human health (in [SUBMISSION.md](SUBMISSION.md))
- [ ] Demo video, 3–5 minutes (user records; full script in [DEMO_SCRIPT.md](DEMO_SCRIPT.md))
- [ ] Working prototype link and public FHIR endpoint in the submission
- [ ] Submit on Devpost by Sep 30 evening IST (user)

## 6. Demo flow (3–5 minute video)

1. **Hook (20 s):** the problem, with one real-looking scenario.
2. **Citizen (60 s):** phone view, report "filamentous algae, water 27 °C" at a stream site.
3. **Standards (45 s):** the same report as FHIR JSON on the public server, validated against the OAH profile.
4. **Risk (45 s):** warm water plus algae plus a dry week trips the bloom rule; the map turns red, with the reasons shown.
5. **Clinic (45 s):** the clinician view shows the alert and what to watch for.
6. **Scale (30 s):** architecture, open standards, open-source stack, any city can deploy it.

## 7. Risk rules (first version)

These are demo heuristics with configurable thresholds, to be calibrated with OAH ecologists. They are not clinical guidance.

| Risk | Trigger | Health concern for clinics |
|---|---|---|
| Algal bloom | Filamentous algae reported **and** water ≥ 25 °C **and** ≤ 5 mm rain in 7 days | Skin irritation, gastrointestinal symptoms after contact |
| Sewage overflow | ≥ 20 mm rain in 24 h **and** foam/colour/smell reported within 48 h | Gastrointestinal infections |
| Mosquito breeding | Diptera reported **and** water ≥ 20 °C **and** rain in the last 7 days | Vector-borne disease watch |
| Low oxygen | Dissolved O₂ < 4 mg/L | Ecosystem stress (fish kills); environmental, not a clinic alert |

## 8. How this maps to the judging criteria

| Criterion | Weight | How we earn it |
|---|---|---|
| Impact & Alignment | 30% | Full One Health loop (environment → human health); uses the OAH IG, OAH indicators and OAH sites |
| Innovation & Creativity | 20% | Citizen-science-to-FHIR alert pipeline for urban streams; few teams attempt FHIR |
| Technical Implementation | 20% | Real HAPI server, profile validation in CI, automated deploys, public FHIR endpoint |
| Usability & UX | 15% | Report in under 30 s, one-screen clinician view, mobile-first, accessible |
| Feasibility & Scalability | 15% | Open standards and open-source stack, zero licence cost, one-command deploy |

## 9. Risks

| Risk | Mitigation |
|---|---|
| OAH IG is a draft and not published as a package | Build it from source with SUSHI; pin the commit we validate against |
| HAPI memory or startup issues | Memory limits set; ~2.3 GB headroom on the host; `/health` smoke test on every deploy |
| AWS credit runs out | Budget alerts at $35/$42/$46/$50; host self-terminates Oct 29 |
| Judges test the live site late | Judging ends Oct 15; host stays up until Oct 29 |
| Scope creep | Must-haves first; should-haves only after the Sep 24 checkpoint |
