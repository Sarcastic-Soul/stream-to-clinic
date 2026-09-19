# Stream-to-Clinic

One Health early warning for urban streams: citizen observations become HL7 FHIR resources, and risky patterns turn into alerts for the clinics that serve the surrounding community.

Built for the [OneAquaHealth IEEE Global Hackathon](https://oneaquahealth-ieee-hackathon.devpost.com/), **Track 7 — Digital Health Standards**.

> Status: early scaffold. The pieces below are wired end to end; features are being added.

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

## Repository layout

| Path | What it is |
|---|---|
| `web/` | Next.js 16 frontend, deployed on Vercel (root directory `web`) |
| `api/` | Fastify + TypeScript API: FHIR mapping, report intake, alerts |
| `fhir/` | HAPI FHIR configuration overrides |
| `deploy/` | Docker Compose stack, Caddy site block and deploy script for the backend host |
| `.github/workflows/` | CI (typecheck, lint, build) and backend deployment |

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
