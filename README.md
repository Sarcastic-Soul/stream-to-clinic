# Stream-to-Clinic

[![Validate FHIR](https://github.com/Sarcastic-Soul/stream-to-clinic/actions/workflows/validate-fhir.yml/badge.svg)](https://github.com/Sarcastic-Soul/stream-to-clinic/actions/workflows/validate-fhir.yml)

One Health early warning for urban streams: citizen observations become HL7 FHIR resources, and risky patterns turn into alerts for the clinics that serve the surrounding community.

Built for the [OneAquaHealth IEEE Global Hackathon](https://oneaquahealth-ieee-hackathon.devpost.com/), **Track 7 — Digital Health Standards**.

**Try it:** [stream-to-clinic.vercel.app](https://stream-to-clinic.vercel.app) · public FHIR R4 endpoint [oneaquahealth.duckdns.org/fhir](https://oneaquahealth.duckdns.org/fhir/metadata) (read-only) · plan and progress in [docs/PLAN.md](docs/PLAN.md) · architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## The problem

Citizens notice when an urban stream changes (algae mats, foam, smell, mosquito larvae), often days before anyone gets sick. That knowledge rarely reaches the clinics that will see the skin, gastrointestinal or vector-borne illness that follows, because environmental data and health data live in separate systems with no shared standard.

## What it does

1. **Citizens report in under 30 seconds** from a phone: pick a stream site (or the nearest by GPS), choose an indicator, enter a value, optionally add a photo. The app is an installable PWA and queues reports while offline.
2. **Every report is standard FHIR from the start:** an `ObservationIndicatorsOah` on a public HAPI FHIR R4 server, using the OneAquaHealth code system and UCUM units. Photos are FHIR `Media` + `Binary`.
3. **An explainable risk engine** combines recent reports with Open-Meteo rainfall: algal bloom, sewage overflow, mosquito breeding and low oxygen. Each alert carries plain-language reasons and a step-by-step account of the decision.
4. **Clinics get standard FHIR alerts:** a `DetectedIssue` (evidence → the triggering Observations) and a `Communication` to each clinic serving that stream. Environmental-only risks stay on the map.
5. **Clinicians see one screen:** alerts for their area, what to watch for, and why.
6. **Other systems can plug in:** a FHIR rest-hook `Subscription` runs the same assessment for Observations written directly to the FHIR server.

| Map and site detail | Report (phone) | Clinic alerts | Alert explained |
|---|---|---|---|
| ![Map with a site panel showing active alerts and latest readings](docs/screenshots/map.webp) | ![Report form on a phone](docs/screenshots/report.webp) | ![Clinic alert list](docs/screenshots/clinic.webp) | ![Alert detail with reasons, step-by-step narrative and FHIR links](docs/screenshots/alert.webp) |

Sites come from the OneAquaHealth IG examples (Almyros and Giofyros in Crete, Benevento in Italy). Clinics and health figures are synthetic demo data, and the risk rules are demonstration heuristics, not clinical guidance.

## How it fits together

```
Citizen / clinician browser (installable PWA, Next.js on Vercel)
        │ HTTPS
        ▼
Caddy (oneaquahealth.duckdns.org, automatic HTTPS)
   ├─ GET /fhir/*  (public, read-only) ─────► HAPI FHIR JPA Server (R4) ──► PostgreSQL 18
   └─ everything else ──► API (Fastify, TypeScript)        ▲        │
                            • maps reports to OAH profiles │ writes │ rest-hook Subscription
                            • risk engine + Open-Meteo ────┘        │ (new Observations,
                            • DetectedIssue + Communication ◄───────┘  internal network)
```

| Concept | FHIR resource |
|---|---|
| Stream site | `Location` (`LocationOah`) |
| Citizen report | `Observation` (`ObservationIndicatorsOah`) |
| Report photo | `Media` + `Binary` |
| District cohort | `Group` (`GroupOah`) |
| Baseline health data | `Observation` (`ObservationHealthMeasureOah`) |
| Clinic and the sites it serves | `Organization` + `HealthcareService` |
| Health alert | `DetectedIssue` |
| Clinic notification | `Communication` |
| Trigger for external observations | `Subscription` (rest-hook) |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#fhir-resource-model). API contract: [docs/API.md](docs/API.md).

## Standards validation

Every change to `api/` is checked against the OneAquaHealth IG with the official HL7 validator (`.github/workflows/validate-fhir.yml`), and CI fails on any profile error.

- **What is validated:** resources produced by the API's own code, not hand-written copies: a citizen report `Observation` for every indicator and value (`ObservationIndicatorsOah`), the seed sites (`LocationOah`), district cohorts (`GroupOah`), baseline health data (`ObservationHealthMeasureOah`), clinics (`Organization`, `HealthcareService`), our `CodeSystem`s, and an alert's `DetectedIssue` and `Communication` (core FHIR R4).
- **Against:** FHIR 4.0.1 and the OAH IG built from source with SUSHI at [`hl7-eu/oah@b907cf0`](https://github.com/hl7-eu/oah/tree/b907cf0869b59d82d9138b3d147fca66f333d911), using HL7 `validator_cli` 6.10.4.
- **Run it:** `cd validation && npm install && npm test` (needs Node.js 22+ and Java 21). Details and known limitations: [validation/README.md](validation/README.md).

## Repository layout

| Path | What it is |
|---|---|
| `web/` | Next.js 16 frontend, deployed on Vercel (root directory `web`) |
| `api/` | Fastify + TypeScript API: FHIR mapping, report intake, alerts |
| `fhir/` | HAPI FHIR configuration overrides |
| `deploy/` | Docker Compose stack, Caddy site block and deploy script for the backend host |
| `validation/` | OAH IG build and FHIR profile validation of the API's resources |
| `.github/workflows/` | CI (typecheck, lint, build), FHIR validation and backend deployment |

## Running locally

Requirements: Node.js 22+ and Docker.

```bash
# Backend: HAPI (localhost:8080/fhir) + Postgres + API (localhost:3001)
docker network create web 2>/dev/null || true
POSTGRES_PASSWORD=dev docker compose -f deploy/compose.yml -f deploy/compose.local.yml up -d --build

# Frontend (localhost:3000)
cd web && npm install && NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

HAPI takes a minute or two to start the first time while it creates its database schema.

## Deployment

- **Frontend:** Vercel builds `web/` on every push.
- **Backend:** pushing to `main` with changes under `api/`, `fhir/` or `deploy/` runs `.github/workflows/deploy-backend.yml`. It signs in to AWS with GitHub OIDC (no stored keys), then uses SSM Run Command to update the repository on the host and run `deploy/deploy.sh`, which rebuilds the stack and reloads Caddy. A smoke test checks `/health` afterwards.

## License

[Apache-2.0](LICENSE)
