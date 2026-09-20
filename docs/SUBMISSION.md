# Devpost submission (draft)

Copy-ready text for the Devpost form. Keep it in sync with what is actually live before submitting (Stage 8 in [PLAN.md](PLAN.md)).

## Project name

Stream-to-Clinic

## Tagline (max ~200 characters)

Citizen stream observations become OneAquaHealth FHIR resources, and risky patterns become standard FHIR alerts for the clinics that serve the neighbourhood.

## Links

- Working prototype: https://stream-to-clinic.vercel.app (Standards overview: https://stream-to-clinic.vercel.app/standards)
- Public FHIR R4 endpoint (read-only): https://oneaquahealth.duckdns.org/fhir/metadata
- Source code: https://github.com/Sarcastic-Soul/stream-to-clinic
- Demo video: _add the YouTube/Vimeo link_

## Track alignment

**Track 7 — Digital Health Standards** ("FHIR models, AI agents, and integration frameworks").

The track's problem is fragmented data and a lack of standards between environmental and health systems. Stream-to-Clinic is an integration framework built on the OneAquaHealth FHIR Implementation Guide itself:

- **FHIR models:** citizen reports are stored as `ObservationIndicatorsOah`, stream sites as `LocationOah`, district cohorts as `GroupOah` and baseline disease prevalence as `ObservationHealthMeasureOah`, using the OAH code system and UCUM units. Alerts are standard FHIR R4 `DetectedIssue` and `Communication` resources that any clinical system can read.
- **Conformance:** every change is validated in CI against the OAH IG, built from source with SUSHI and checked with the official HL7 validator. Resources come from the application's real code, not hand-written samples, and CI fails on any profile error.
- **Agent:** an explainable risk engine reads new observations and live weather, decides whether a health risk exists, and writes down each step of its reasoning inside the FHIR alert.
- **Integration:** a public FHIR server and a FHIR `Subscription` mean other OAH systems can write observations and have them assessed through standard FHIR alone. Any site's data downloads as one FHIR `Bundle`, and a Standards page in the app links to live example resources.

It also draws on Track 6 (early-warning alerts) and Track 2 (map dashboard) to close the One Health loop.

## Problem

Citizens already notice when an urban stream changes: algae mats, foam, smell, mosquito larvae, dead fish. OneAquaHealth has citizen-science tools and a FHIR Implementation Guide for environmental and health indicators. But what citizens see rarely reaches the people who treat the illnesses that follow, such as skin and gastrointestinal illness after contact with bloom water or sewage overflow, or vector-borne disease. Environmental data and health data sit in separate systems with no shared standard. Clinics usually learn about an environmental health risk only after patients arrive.

## Solution

Stream-to-Clinic connects the two with open standards:

1. **Report in under 30 seconds.** A mobile-first, installable web app lets anyone pick a stream site (or the nearest one by GPS) and report what they see: water temperature, pH, dissolved oxygen, conductivity, foam, filamentous algae or mosquito larvae, optionally with a photo. It works offline and sends queued reports when the connection returns.
2. **Standard from the first byte.** Each report becomes an `ObservationIndicatorsOah` resource on a public HAPI FHIR R4 server, conformant to the OneAquaHealth IG.
3. **Explainable risk engine.** Rules combine recent reports with live rainfall from Open-Meteo: algal bloom (algae, warm water, dry week), sewage overflow (heavy rain plus foam), mosquito breeding (larvae, warm water, recent rain) and low oxygen. Every alert lists the reasons in plain language and a step-by-step account of the decision, and links to the evidence observations.
4. **Alerts clinics can consume.** A triggered rule creates a FHIR `DetectedIssue` and sends a `Communication` to each clinic serving that stream. Environmental-only risks, like low oxygen, stay on the map without alerting clinics.
5. **One screen for clinicians.** The clinic view lists alerts for the clinic's area, newest first, with what to watch for (for example, gastrointestinal cases after heavy rain and foam upstream) and why.

## Target users

- **Citizen scientists:** report quickly and see that their report mattered.
- **Public health officers:** a live map of stream risk across districts.
- **Clinicians and clinics:** early, explained warnings for their catchment area.
- **Ecologists and OAH researchers:** standardised, reusable (FAIR) data on a public FHIR endpoint.

## Expected impact on ecosystem and human health

- **Earlier clinical awareness:** a bloom reported on Monday can reach nearby clinics the same day, not after the first cases.
- **Healthier streams:** low-oxygen and pollution signals are visible to the people who manage the stream while there is still time to act.
- **From one report to a pattern:** the same reports roll up into a four-week catchment view — which stream is warming, losing oxygen or rising in conductivity, and how many alerts each region's clinics have answered — so an authority can act before a threshold is crossed.
- **Reusable data:** because everything is OAH-conformant FHIR, any city, research group or health system can read the same data without custom integration.
- **Low cost to adopt:** open standards, an open-source stack and one-command deployment, with no licence fees.

### The numbers

| Measured | Value |
|---|---|
| Report to answer | ~0.8–1.1 s from pressing Send to the report being stored, every rule for that site re-evaluated and the result returned (three live calls against the deployed API) |
| Alert reaches the clinic | In the same request: the `DetectedIssue` and one `Communication` per serving clinic are written in a single FHIR transaction, so there is no batch job and no polling delay |
| Time to file a report | Under 30 seconds on a phone, and it works with no signal — reports queue on the device and sync later |
| Standards conformance | 59 resources generated by the API's real code, checked in CI by HL7 `validator_cli` 6.10 against the OAH IG: **0 errors** |
| Accessibility | axe-core on 8 pages × 2 themes × 3 languages: **0 violations** |
| Demo footprint | 4 OAH pilot sites, 4 clinics, 2 countries, 7 citizen indicators, 4 risk rules, 3 languages |
| Cost to run | €0 — free tiers and one small cloud host; no licence fees, no per-seat pricing, no API keys to buy |

Reach, if the demo clinics were real: the two Cretan sites sit in the Heraklion municipality, population **179,302** (2021 census), and the Italian site is in Benevento, population **55,319** (30 June 2025). Those are the populations a handful of citizen reports would be warning clinics about.

## How we built it

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, MapLibre GL with OpenFreeMap tiles, Recharts; installable PWA with an offline report queue. English, Greek and Italian for the citizen-facing screens, matching the countries of the pilot sites; light, dark or system theme; a colourful basemap with place names in one language and nearby sites clustered with a count; axe reports 0 accessibility violations on every page in both themes.
- **API:** Fastify 5 on Node.js 24 LTS, TypeScript. Maps reports to OAH profiles, writes a `Provenance` for each one, runs the risk engine, writes alerts, and takes clinic replies back as `Communication` resources with `inResponseTo`, so the loop closes in standard resources.
- **FHIR server:** HAPI FHIR JPA Server 8.12 (R4) on PostgreSQL 18, public read-only behind Caddy with automatic HTTPS.
- **Standards tooling:** SUSHI builds the OAH IG from source at a pinned commit; HL7 `validator_cli` 6.10 validates the application's resources in GitHub Actions.
- **Weather:** Open-Meteo (free, no key, CC BY 4.0).
- **Delivery:** GitHub Actions deploys the backend to a small cloud host using OIDC and SSM (no stored keys, no open SSH port); Vercel deploys the frontend.

## Challenges

- The OAH IG is a draft and is not published as a package, so we build it from source and pin the commit we validate against.
- A full FHIR server does not fit free hosting tiers, so we run HAPI on a small, self-terminating cloud host within a fixed credit budget.
- Keeping alerts explainable: every rule records which condition was met, with which observation and which weather reading.

## Accomplishments

- An end-to-end One Health loop from citizen report to clinic alert, built entirely on FHIR R4 and the OAH IG.
- Profile validation in CI on resources generated by the real code: 0 errors.
- A public FHIR endpoint judges can query directly.

## What we learned

- The OAH IG already models the hard part, a shared vocabulary for environmental and health indicators. Standard FHIR alert resources are enough to connect it to clinics.
- Explainability matters more than model complexity when an alert asks a clinician to act.

## What's next

- Calibrate thresholds with OAH ecologists and add indicators from the OAH field sampling protocols.
- SMART on FHIR launch so the clinician view opens inside existing clinical systems.
- Connect to the OneAquaHealth citizen-science app as an additional observation source through the FHIR Subscription.
- Aggregate, privacy-preserving health signals (syndromic counts) to close the loop in the other direction.

## Notes for judges

- All sites come from the OneAquaHealth IG examples (Almyros and Giofyros in Crete, Benevento in Italy). Clinics and health figures are synthetic demo data. Risk rules are demonstration heuristics, not clinical guidance.
- Try it: open the map, pick a site, submit a report, then follow the link to the created FHIR resource. The Standards page (https://stream-to-clinic.vercel.app/standards) maps every concept to its FHIR resource and OAH profile, with live examples.
