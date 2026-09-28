# Devpost form, field by field

Copy each block into the matching Devpost field. The longer reference text is in [SUBMISSION.md](SUBMISSION.md).

## Elevator pitch (max 200 characters)

```
Citizen stream reports become OneAquaHealth FHIR records, and risky patterns become standard FHIR alerts for the clinics nearby, in about a second.
```

## About the project

```markdown
## Inspiration

People who walk by an urban stream notice when it changes: green algae mats, foam, a bad smell, mosquito larvae. Days later, the clinic down the road sees rashes, stomach bugs or insect-borne illness and has no idea why. The warning was there early, but environmental data and health data live in separate systems with no shared standard.

OneAquaHealth already has citizen-science tools and a FHIR Implementation Guide for environmental and health indicators. We wanted to use that guide to close the gap: from what a citizen sees at the stream to a warning a clinic can act on.

## What it does

- **Report in under 30 seconds.** Anyone picks a stream site (or the nearest one by GPS), says what they see (water temperature, pH, dissolved oxygen, conductivity, foam, algae, mosquito larvae), optionally adds a photo, and sends. It works offline and sends queued reports later.
- **Standard from the first byte.** Each report is stored as an `ObservationIndicatorsOah` resource on a public HAPI FHIR R4 server, following the OneAquaHealth IG, with a `Provenance` naming the reporter.
- **Explainable risk engine.** Rules combine recent reports with live rainfall from Open-Meteo: algal bloom, sewage overflow, mosquito breeding and low oxygen. Every alert lists its reasons in plain language, a step-by-step account of the decision, and links to the evidence.
- **Clinics warned live.** A risky pattern creates a FHIR `DetectedIssue` and a `Communication` to every clinic serving that stream. An open clinic page shows it within a second (Server-Sent Events); an installed clinic app gets a web push.
- **The loop closes.** A clinic replies in one click ("patients advised about the water"). The reply is a FHIR `Communication` linked to the alert, and a clinician signed in with SMART on FHIR signs it with a `Provenance`.
- **Citizens see what their report did.** Each report has a page: stored, checked, the alert it helped raise, which clinics were told and what they did.
- **Patterns, not just alerts.** A four-week trend view shows which stream is warming or losing oxygen before a threshold is crossed.
- **AI kept in its place.** A small model rewrites an alert as a notice for the clinic desk, from the engine's reasons only, and an agent answers questions about the data using read-only FHIR searches it lists for you. Neither ever decides a risk level, and machine-written text is marked as written by a `Device`.
- **English, Greek and Italian**, the languages of the pilot sites, on every page.

## How we built it

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, MapLibre GL with OpenFreeMap tiles, Recharts. Installable PWA with an offline report queue. Hosted on Vercel.
- **API:** Fastify 5 on Node.js 24, TypeScript. It maps reports to OAH profiles, runs the risk engine, writes alerts in one FHIR transaction, and streams them to clinics.
- **FHIR server:** HAPI FHIR JPA Server 8.12 (R4) on PostgreSQL 18, public and read-only behind Caddy with HTTPS, on one small AWS EC2 host.
- **Standards tooling:** SUSHI builds the OAH IG from source, then our own FSH profiles on top (alert, clinic notice, reply, AI advisory, report provenance). The official HL7 validator checks resources made by the app's real code in GitHub Actions: 0 errors.
- **SMART on FHIR:** a small SMART App Launch 2.0 server (EHR and standalone launch, PKCE), with the clinic view as a SMART app.
- **AI:** GLM 4.7 Flash on Amazon Bedrock (Ministral 3 14B as fallback), with six read-only FHIR tools. The same tools are a public MCP server any assistant can use. Capped at 100 model requests a day.
- **Integration:** a FHIR `Subscription` means any other OAH system that writes an Observation gets the same risk check, using only standard FHIR.
- **Delivery:** GitHub Actions deploys the backend over AWS OIDC and SSM (no stored keys, no open SSH port); Playwright journey tests run in CI.

## Challenges we ran into

- The OAH IG is a draft and not published as a package, so we build it from source and pin the commit we validate against.
- The IG models observations but not alerts or clinic messages, so we wrote our own profiles on top of it and validate both.
- A full FHIR server does not fit free hosting tiers, so we run HAPI on one small cloud host within a fixed credit budget.
- Keeping alerts explainable: every rule records which condition was met, with which observation and which weather reading.
- Picking a language model that is cheap and does not make up numbers: we tested eleven models against live data and kept the cheapest one that got every question right.

## Accomplishments that we're proud of

- A full One Health loop, from a citizen's phone to a clinic's screen and back, in standard FHIR R4 resources.
- A report reaches a clinic in about one second.
- 0 validator errors against the OAH IG on resources made by the real code.
- A public FHIR endpoint judges can query directly, and a public MCP server.
- Real OAH pilot sites in Crete and Campania, in the three languages spoken there.

## What we learned

- The OAH IG already solves the hard part: a shared vocabulary for environmental and health indicators. Standard FHIR alert resources are enough to connect it to clinics.
- Explainability matters more than model complexity when an alert asks a clinician to act.
- AI is most useful when it writes and explains, and the decision stays with rules people can read.

## What's next for Stream-to-Clinic

- Tune the thresholds with OAH ecologists and add indicators from the OAH field sampling protocols.
- Register the clinic app with a real EHR sandbox and use the clinic's own sign-in.
- Connect the OneAquaHealth citizen-science app as another report source through the FHIR Subscription.
- Send anonymous clinic case counts back the other way, so a spike in cases can prompt a check of the stream.

The sites come from the OneAquaHealth IG examples. Clinics and health figures are synthetic demo data, and the risk rules are demonstration heuristics, not clinical guidance.
```

## Built with (25 tags)

```
typescript, next.js, react, tailwindcss, shadcn-ui, maplibre, recharts, node.js, fastify, hl7-fhir, hapi-fhir, postgresql, docker, caddy, amazon-ec2, amazon-bedrock, vercel, github-actions, open-meteo, smart-on-fhir, model-context-protocol, fsh-sushi, playwright, pwa, server-sent-events
```

## "Try it out" links

```
https://stream-to-clinic.vercel.app
https://github.com/Sarcastic-Soul/stream-to-clinic
https://oneaquahealth.duckdns.org/fhir/metadata
https://stream-to-clinic.vercel.app/standards
```

## Image gallery

Eleven 3:2 PNGs (2250 × 1500, each under 1 MB) are in `docs/gallery/`, numbered in upload order. Suggested captions:

1. `01-cover`: Stream to clinic, instantly.
2. `02-live-loop`: A citizen's report reaches the clinic's phone in under a second, through four FHIR steps.
3. `03-report-three-languages`: The report form in English, Greek and Italian.
4. `04-map`: The four OneAquaHealth pilot sites in Crete and Campania, coloured by risk.
5. `05-clinic-alerts`: A clinic's live alert list for the streams near it.
6. `06-explained-alert`: Every alert says why it was raised and how the decision was made.
7. `07-report-journey`: A citizen follows their report from FHIR record to the clinics it reached.
8. `08-ask-the-data`: The agent answers from the FHIR server and shows every search it ran.
9. `09-trends`: Four-week trends show which stream is warming or losing oxygen.
10. `10-standards`: Every concept mapped to its FHIR resource and OAH profile.
11. `11-phones-dark`: Works on any phone, in light or dark mode.

Shots 02, 05, 06 and 07 come from the offline demo build (hence the "Demo data" badge), so taking them did not create real alerts on the live server.
