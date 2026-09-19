# Stream-to-Clinic

[![Validate FHIR](https://github.com/Sarcastic-Soul/stream-to-clinic/actions/workflows/validate-fhir.yml/badge.svg)](https://github.com/Sarcastic-Soul/stream-to-clinic/actions/workflows/validate-fhir.yml)

One Health early warning for urban streams: citizen observations become HL7 FHIR resources, and risky patterns turn into alerts for the clinics that serve the surrounding community.

Built for the [OneAquaHealth IEEE Global Hackathon](https://oneaquahealth-ieee-hackathon.devpost.com/), **Track 7 — Digital Health Standards**.

> Status: early scaffold. The pieces below are wired end to end; features are being added.
> Plan and progress: [docs/PLAN.md](docs/PLAN.md) · Architecture and tech stack: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## How it fits together

```
Citizen PWA (Next.js, Vercel)
        │  HTTPS
        ▼
Caddy (oneaquahealth.duckdns.org) ──► API (Fastify, TypeScript)
        │  GET /fhir/* (read-only)          │  maps reports to OAH FHIR profiles
        ▼                                   ▼
             HAPI FHIR JPA Server (R4) ◄────┘
                        │
                   PostgreSQL 18
```

- **Standards:** observations follow the OneAquaHealth FHIR Implementation Guide ([hl7-eu/oah](https://github.com/hl7-eu/oah), FHIR 4.0.1). Citizen reports map onto the `ObservationIndicatorsOah` profile using codes from the OAH code system.
- **Public FHIR endpoint:** `https://oneaquahealth.duckdns.org/fhir/` is readable by anyone (for example `/fhir/metadata`). Writes only go through the API.

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
