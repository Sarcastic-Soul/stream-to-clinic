# Stream-to-Clinic: Architecture and Tech Stack

Last updated: 2026-09-19. For scope, stages and progress see [PLAN.md](PLAN.md).

## Principles

- **Latest stable, LTS where it exists.** Stability over novelty: skip brand-new majors until their tooling catches up (see TypeScript below).
- **Open standards first.** HL7 FHIR R4 with the OneAquaHealth IG profiles; UCUM units; no licensed terminologies needed.
- **Zero cost.** Only free services, plus the host running on existing AWS credits.
- **Explainable over clever.** Rule-based risk engine; every alert carries its reasons.

## System overview

```
Citizen / clinician browser
        │
        ▼
Next.js app on Vercel (stream-to-clinic.vercel.app)
        │ HTTPS (CORS-restricted)
        ▼
Caddy on the EC2 host (oneaquahealth.duckdns.org, Let's Encrypt)
   ├─ GET /fhir/*  ───────────► HAPI FHIR JPA Server (R4) ──► PostgreSQL
   │   (read-only for the public; writes answer 405)
   └─ everything else ────────► API (Fastify, TypeScript)
                                  ├─ maps citizen reports to OAH profiles
                                  ├─ risk engine (+ Open-Meteo weather)
                                  └─ writes DetectedIssue / Communication to HAPI
```

## Tech stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Frontend framework | Next.js (App Router) | 16.3 | Hosted on Vercel Hobby, root directory `web/` |
| UI runtime | React | 19.2 | Version pinned by Next.js |
| Styling | Tailwind CSS | 4 | shadcn/ui components planned |
| Maps (planned) | MapLibre GL + OpenFreeMap tiles | 6.x | No API key; OSM attribution required |
| Charts (planned) | Recharts | 3.x | |
| PWA (planned) | Serwist (`@serwist/next`) | 9.x | Recommended by the Next.js PWA guide; `next-pwa` is abandoned |
| API framework | Fastify | 5.12 | TypeScript, ES modules |
| FHIR types | `@types/fhir` | 0.0.44 | `fhir4.*` namespace (R4) |
| Language | TypeScript | web 5.x, API 6.0 | TS 7 (native rewrite) skipped until Next.js and ESLint support it |
| Runtime | Node.js | 24 LTS | Docker images and CI; Node 22 LTS also works locally |
| FHIR server | HAPI FHIR JPA Server Starter | 8.12.0 (`hapiproject/hapi:v8.12.0-1`) | FHIR R4, rest-hook subscriptions enabled |
| Database | PostgreSQL | 18 (alpine) | Local to the host; HAPI keeps connections open, which rules out scale-to-zero hosted DBs |
| Reverse proxy / TLS | Caddy | 2.x | Automatic HTTPS; one site file per project |
| Weather | Open-Meteo API | — | Free for non-commercial use, no key; CC BY 4.0 attribution ("Weather data by Open-Meteo.com"). Hourly rainfall, cached 1 h per site |
| Validation (planned) | SUSHI + HL7 `validator_cli` | validator 6.10.x | Builds the OAH IG from source and validates resources in CI |
| Host OS | Ubuntu Server | 24.04 LTS (arm64) | |
| Containers | Docker Engine + Compose | 29.x / 5.x | |

## Standards

- **FHIR version:** R4 (4.0.1), matching the OAH IG.
- **OAH IG:** [hl7-eu/oah](https://github.com/hl7-eu/oah), canonical `http://hl7.eu/fhir/ig/oah`, draft, not on packages.fhir.org (build from source).
- **Profiles used:** `ObservationIndicatorsOah`, `ObservationHealthMeasureOah`, `LocationOah`, `GroupOah`.
- **Codes:** OAH temporary code system `http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu`; units in UCUM.
- Code constants live in `api/src/oah.ts`; report mapping in `api/src/mapping.ts`.

### FHIR resource model

| Concept | Resource | Notes |
|---|---|---|
| Stream site | `Location` (`LocationOah`) | Ids, identifiers, names and coordinates from the IG examples: `Loc-Almyros`, `Loc-Giofyros`, `Loc-Giofyros-LowerReach`, `Loc-Benevento`. `partOf` points to the water body (plain `Location`); `address.text` holds the region. `GET /sites` lists every `LocationOah` |
| Citizen report | `Observation` (`ObservationIndicatorsOah`) | Quantities in UCUM; presence indicators (foam, algae, diptera) coded `absent`/`present`/`abundant` from our `CodeSystem/presence` |
| Clinic | `Organization` | Fictional, names end in "(demo)" |
| Clinic serves site | `HealthcareService` | `providedBy` the clinic, `coverageArea` the sites it serves (standard R4, no extension) |
| District cohort | `Group` (`GroupOah`) | `cohort-<siteId>`: residents living near a site (IG "Living place" characteristic) |
| Health baseline | `Observation` (`ObservationHealthMeasureOah`) | OAH codes `gastrointestinal`, `campylobacter`; subject = site, focus = cohort, previous calendar year |
| Alert | `DetectedIssue` | Identifier `…/sid/alert` = `<siteId>:<risk>` (one active issue per site and risk); `code` from our `CodeSystem/water-health-risk`; `implicated` = site; one `evidence` entry per reason, with `detail` → triggering Observations; `mitigation.action.text` = what clinicians should watch for. Active until `identifiedPeriod.end` is set, which happens when a re-evaluation no longer fires the rule |
| Clinic notification | `Communication` | Category `alert`, `about` → DetectedIssue, `recipient` → clinic, `subject` → district cohort. Sent once per clinic when the issue is raised; none for low oxygen (environmental only) |

Seed data (`api/src/seed.ts`) is one transaction of PUTs with fixed ids, applied on every API start (idempotent; HAPI skips unchanged resources). Synthetic resources carry the `HTEST` tag. The seed includes two weeks of citizen history per site, dated relative to the start time, then every site is evaluated once.

The risk engine (`api/src/rules.ts`, pure) implements the rules in PLAN.md section 7 and records a plain-language reason for every condition, met or not (logged as `risk decision`). `api/src/alerts.ts` turns decisions into FHIR resources; it runs after every `POST /reports` for that site. If Open-Meteo is down, rain-dependent rules do not fire and the reason says the weather was unavailable. For demo recordings, `WEATHER_OVERRIDE='{"rain24h":0,"rain7d":1.2}'` fixes rainfall; reasons then say "demo weather override".

## Repository layout

| Path | Contents |
|---|---|
| `web/` | Next.js frontend |
| `api/` | Fastify API: `src/server.ts` routes, `src/fhir.ts` client, `src/oah.ts` codes, `src/mapping.ts` report mapping, `src/store.ts` site/clinic reads, `src/seed.ts` demo data, `src/rules.ts` risk rules, `src/weather.ts` Open-Meteo, `src/alerts.ts` DetectedIssue/Communication; `test/` unit tests (`npm test`) |
| `fhir/application.yaml` | HAPI overrides (Postgres, R4, server address, subscriptions, CORS) |
| `deploy/compose.yml` | Production stack: postgres, hapi, api (memory limits set) |
| `deploy/compose.local.yml` | Local override publishing ports 8080 (HAPI) and 3001 (API) |
| `deploy/caddy/stream-to-clinic.caddy` | Caddy site block, installed onto the host by the deploy script |
| `deploy/deploy.sh` | Runs on the host: creates secrets on first run, rebuilds, reloads Caddy |
| `.github/workflows/ci.yml` | Typecheck, lint and build for `api/` and `web/` |
| `.github/workflows/deploy-backend.yml` | Backend deploy |
| `docs/` | Plan and architecture (this file) |

## Hosting and deployment

**Frontend.** Vercel builds `web/` on every push. `NEXT_PUBLIC_API_URL` is set in the Vercel project. Preview deployments are not in the API's CORS allow-list.

**Backend host.** One AWS EC2 `t4g.medium` (2 vCPU, 4 GB RAM + 2 GB swap, arm64) in `us-east-1`, shared with other hackathon backends. Each project lives in its own directory under `/srv`, runs its own compose project with memory limits, and exposes itself only through the shared Caddy container on the `web` Docker network. Only ports 80 and 443 are open; shell access is through AWS Systems Manager Session Manager (no SSH port).

**Backend deploys.** A push to `main` touching `api/`, `fhir/`, `deploy/` or the workflow runs `deploy-backend.yml`:
1. GitHub Actions gets short-lived AWS credentials through OIDC (no stored keys). The role may only run SSM commands on this host.
2. SSM Run Command updates `/srv/stream-to-clinic` to the pushed commit and runs `deploy/deploy.sh`.
3. The script rebuilds and restarts the stack, installs the Caddy site file, and reloads Caddy.
4. The workflow smoke-tests `https://oneaquahealth.duckdns.org/health`.

Configuration values for the workflow (role ARN, instance ID) are GitHub repository variables. Server secrets (Postgres password, CORS origins) are generated on the host in `/srv/env/stream-to-clinic.env` and never committed.

**Lifetime and cost.** The host runs on a time-limited AWS credit: budget alerts are configured, and the instance terminates itself on **2026-10-29** (after judging ends on Oct 15). All demo data must be reproducible from the seed script, since the database goes with the host.

## Resource budget on the host

| Container | Memory limit | Typical use |
|---|---|---|
| HAPI FHIR | 1280 MB | ~830 MB |
| PostgreSQL | 256 MB | ~60 MB |
| API | 256 MB | ~25 MB |
| Caddy (shared) | 128 MB | ~11 MB |

About 2.3 GB remains for other projects.

## Local development

```bash
docker network create web 2>/dev/null || true
POSTGRES_PASSWORD=dev docker compose -f deploy/compose.yml -f deploy/compose.local.yml up -d --build
cd web && npm install && NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```
