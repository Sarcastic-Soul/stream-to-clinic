# Stream-to-Clinic API contract

Base URL: `https://oneaquahealth.duckdns.org` (local: `http://localhost:3001`). JSON over HTTPS. The API is the only writer to the FHIR server; FHIR resources stay readable at `/fhir/*`.

This file is the contract between `web/` and `api/`. Change it together with both sides.

## Types

```ts
type RiskLevel = "none" | "low" | "medium" | "high";
type IndicatorKind = "quantity" | "presence";
type Presence = "absent" | "present" | "abundant";

interface Indicator {
  id: string;              // e.g. "waterTemperature", "filamentousAlgae"
  display: string;         // "Water temperature"
  kind: IndicatorKind;
  unit?: string;           // UCUM code for quantity indicators, e.g. "Cel"
  unitLabel?: string;      // human label, e.g. "°C"
  min?: number;            // plausible input range for quantity indicators
  max?: number;
}

interface ObservationSummary {
  id: string;              // FHIR Observation id
  indicator: string;       // Indicator.id
  value: number | Presence;
  unit?: string;
  observedAt: string;      // ISO 8601
  reporter: string;
  photoUrl?: string;       // absolute URL of the attached photo (served by GET /photos/:id)
}

interface SiteSummary {
  id: string;              // FHIR Location id
  name: string;
  waterBody: string;       // e.g. "Almyros Stream"
  region: string;          // e.g. "Crete, Greece"
  lat: number;
  lon: number;
  riskLevel: RiskLevel;    // highest level among active alerts, else "none"
  latest: ObservationSummary[];   // most recent observation per indicator
}

interface SiteDetail extends SiteSummary {
  observations: ObservationSummary[];  // newest first, up to 50
  alerts: AlertSummary[];              // active alerts for this site
  clinics: ClinicSummary[];            // clinics serving this site
}

interface ClinicSummary {
  id: string;              // FHIR Organization id
  name: string;
  city: string;
  siteIds: string[];
}

interface AlertSummary {
  id: string;              // FHIR DetectedIssue id
  risk: "algal-bloom" | "sewage-overflow" | "mosquito-breeding" | "low-oxygen";
  title: string;           // "Possible algal bloom"
  level: RiskLevel;
  siteId: string;
  siteName: string;
  createdAt: string;
  status: "active" | "closed";  // closed once a later evaluation no longer meets the rule
  closedAt?: string;       // set when status is "closed"
  reasons: string[];       // plain-language, one per satisfied condition
  watchFor: string;        // what clinicians should watch for ("" for environmental-only risks)
  narrative: string[];     // step-by-step account of how the engine reached this alert, in plain language
  evidence: string[];      // bare Observation ids that triggered the alert (public URL: /fhir/Observation/<id>)
  acknowledgements: Acknowledgement[];  // clinic replies, oldest first; empty until one answers
  fhir: { detectedIssue: string; communications: string[] };  // public /fhir URLs
}

type AckAction = "staff-briefed" | "patients-advised" | "authority-notified" | "no-action";

// A notified clinic's reply, stored as a FHIR Communication with inResponseTo pointing
// at the alert Communication it answers.
interface Acknowledgement {
  id: string;              // FHIR Communication id
  clinicId: string;        // FHIR Organization id
  clinicName: string;
  action: AckAction;
  actionLabel: string;     // human-readable form of action
  note?: string;           // free text from the clinic
  at: string;
  fhirUrl: string;         // public /fhir URL
  signedBy?: { name: string; fhirUser: string; provenance: string };  // clinician, when sent with a SMART token
}

// A notice for clinic staff, drafted by a language model from an alert the rules already decided.
// Stored as a Communication sent by a Device, with a Provenance naming that Device as author.
interface Advisory {
  id: string;              // FHIR Communication id
  text: string;
  model: string;           // model that drafted it
  generatedAt: string;
  fhirUrl: string;
}

// GET /trends: what weeks of reports add up to, per site and per region.
type TrendDirection = "rising" | "falling" | "steady";

interface IndicatorTrend {
  indicator: string;       // Indicator.id
  display: string;
  kind: IndicatorKind;
  unitLabel?: string;
  reports: number;
  points: { date: string; value: number }[];  // one per day: mean for a quantity,
                                              // count of present/abundant for a presence
  earlier?: number;        // mean over the older half of the reported period
  recent?: number;         // mean over the newer half
  change?: number;         // recent - earlier
  direction: TrendDirection;  // "steady" unless the change clears the smaller of a tenth of the
                              // earlier mean and a per-indicator "noticeable" amount (1 °C, 0.4 mg/L …)
}

interface SiteTrend {
  siteId: string;
  name: string;
  waterBody: string;
  region: string;
  reports: number;
  reporters: number;       // distinct reporter names
  riskLevel: RiskLevel;
  activeAlerts: { id: string; title: string; level: RiskLevel; answered: boolean }[];
  indicators: IndicatorTrend[];
  health: { code: string; display: string; value: number; unit: string; period: string }[];
                           // district baselines (ObservationHealthMeasureOah)
}

interface RegionTrend {
  region: string;
  sites: number;
  reports: number;
  sitesAtRisk: number;
  activeAlerts: number;
  answeredAlerts: number;
}

interface Trends {
  from: string;            // ISO 8601
  to: string;
  days: number;
  totals: { sites: number; reports: number; reporters: number; activeAlerts: number; answeredAlerts: number };
  regions: RegionTrend[];  // by region name
  sites: SiteTrend[];      // worst risk first, then most reports
}

// GET /reports/:id/journey: what the system did with one citizen report.
interface JourneyAlert extends AlertSummary {
  notified: { clinicId: string; clinicName: string; at: string; fhirUrl: string }[];
                           // the Communications sent to clinics, oldest first; [] for environmental risks
  advisory?: Advisory;
}

interface ReportJourney {
  report: ObservationSummary;
  site: { id: string; name: string; waterBody: string };
  fhirUrl: string;         // the Observation
  provenance?: { recorded: string; agents: string[]; fhirUrl: string };
  alerts: JourneyAlert[];  // DetectedIssues that cite the report as evidence (in any version), oldest first
}
```

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ status: "ok", fhir: "4.0.1", advisory: boolean, agent: boolean }` (`advisory` and `agent` say whether a model is configured; `BEDROCK_MODEL=off` turns them off) or 503 |
| GET | `/indicators` | `Indicator[]` |
| GET | `/sites` | `SiteSummary[]` |
| GET | `/sites/:id` | `SiteDetail` or 404 |
| GET | `/sites/:id/bundle` | FHIR R4 `Bundle` (type `collection`, `application/fhir+json`, sent as a `<siteId>-bundle.json` download) or 404. Contains the site `Location` and its water body, the district `Group` and its health-measure baselines, the serving clinics (`Organization`, `HealthcareService`), the last 30 days of citizen `Observation`s (up to 200) with their photo `Media` (the `Binary` stays a link), and the site's `DetectedIssue`s (active and closed) with their `Communication`s. `fullUrl`s are public `/fhir` URLs |
| POST | `/reports` | `201 { observation: ObservationSummary, fhirUrl: string, alerts: AlertSummary[] }` — `alerts` lists alerts raised or updated by this report. Also writes a FHIR `Provenance` naming the reporter as author and the app as assembler, targeting the `Observation` (and its photo `Media`); a failed lineage write is logged, never fatal |
| GET | `/reports/:id/journey` | `ReportJourney` for a citizen `Observation`, or 404. An alert counts if any stored version of its `DetectedIssue` cited the report, since the engine rewrites active alerts in place as new reports arrive |
| GET | `/clinics` | `ClinicSummary[]` |
| GET | `/alerts?clinicId=&siteId=` | Active `AlertSummary[]`, newest first, both filters optional. `clinicId` returns only alerts sent to that clinic, so environmental-only risks (low oxygen) are excluded |
| GET | `/alerts/:id` | `AlertSummary` (active or closed), plus `advisory: Advisory` when one has been drafted, or 404 |
| POST | `/alerts/:id/acknowledge` | `201 AlertSummary` — a notified clinic reports what it did. 404 for an unknown alert or clinic, 409 if that clinic was not notified about this alert. With `Authorization: Bearer <SMART access token>` the reply is signed (below): 401 for a token we did not issue or that expired, 403 if the token is for another clinic or lacks `user/Communication.c` |
| POST | `/alerts/:id/advisory` | `201 Advisory` — rewrites the alert as a short notice for clinic staff. Returns the existing advisory if there is one, so the text cannot change under a clinic that has read it. 404 unknown alert, 429 when the day's shared cap of model requests (100 by default) is used up, 503 if no model is configured on the server, 502 if the model could not be reached |
| GET | `/trends?days=` | `Trends` — `days` is an integer between 7 and 90, default 28. Counts citizen `Observation`s and active `DetectedIssue`s per site and per region, with a daily series and a direction per indicator, and the district health baselines alongside |
| GET | `/events?clinicId=` | Server-Sent Events (`text/event-stream`). Sends `ready` on connect, then one `alert` event (data: `AlertSummary`) per alert newly raised and sent to that clinic; without `clinicId`, every newly raised alert. Refreshes of an already active alert are not sent. A `: ping` comment every 25 s; 503 when 200 streams are already open |
| GET | `/push/key` | `{ publicKey }` (VAPID, base64url) for `PushManager.subscribe`, or 503 when web push is not configured |
| POST | `/push/subscriptions` | Body `{ clinicId, subscription: { endpoint, keys: { p256dh, auth } } }` (`PushSubscription.toJSON()`). `201`; one clinic per device (a new call for the same endpoint replaces the clinic). 400 unless the endpoint is `https` on a browser push service (FCM, Mozilla, Apple, Windows), 404 unknown clinic, 503 not configured. Every alert newly sent to that clinic is then pushed as `{ title, body, url, tag }` |
| POST | `/push/unsubscribe` | Body `{ endpoint }`; 204 |
| POST | `/push/test` | Body `{ endpoint }` of a subscribed device; sends it a test notification. `{ sent: true }`, 404 not subscribed, 502 refused by the push service |
| POST | `/agent/ask` | `200 AgentAnswer` — body `{ question: string }` (3–500 characters). An AI agent answers from the FHIR data using read-only tools (below). The same question within 10 minutes gets the stored answer. 503 if no model is configured, 429 over 5 questions a minute from one client or when the day's shared cap of model requests (100 by default, shared with the advisory) is used up, 502 if the model failed or every configured model is busy (a busy model hands the question to the next one), 504 if it took longer than 55 s |
| POST | `/mcp` | Model Context Protocol server (Streamable HTTP, stateless, JSON responses) exposing the same read-only tools. Clients must send `Accept: application/json, text/event-stream`. `GET` and `DELETE` answer 405 |
| GET | `/fhir/.well-known/smart-configuration` | SMART App Launch 2.0 discovery (served by the API; Caddy routes this one path under `/fhir` to it) |
| GET | `/smart/authorize` | Authorization endpoint (code flow). Requires `client_id=stream-to-clinic-clinic-app`, a registered `redirect_uri` (`<web origin>/smart/callback`), `aud` = the public FHIR base, `state`, and PKCE `S256`. With a valid `launch` (EHR launch) it redirects with a code at once; otherwise it shows the demo clinician sign-in page. Unknown client or redirect: 400 page; other problems: redirect with `error=invalid_request` |
| POST | `/smart/authorize` | The sign-in form: the same parameters plus `practitioner_role`; 303 to `redirect_uri?code&state`. Codes are single use and last 2 minutes |
| POST | `/smart/token` | Form body `grant_type=authorization_code, code, redirect_uri, client_id, code_verifier`. Returns `{ access_token, token_type: "Bearer", expires_in: 3600, scope, id_token?, fhirContext: [{reference: "Organization/<clinic>"}, {reference: "PractitionerRole/<role>"}], need_patient_banner: false }` with `Cache-Control: no-store`. Tokens are RS256 JWTs; `fhirUser` is the clinician's `Practitioner` |
| GET | `/smart/jwks.json` | Public key set for the tokens |
| GET | `/smart/ehr?clinic=&app=` | Demo EHR page for a clinic. `app` must be `<web origin>/smart/launch`; its button opens the app with `iss` and a signed `launch` token (10 minutes) |
| GET | `/photos/:id` | The photo bytes (`image/jpeg`, `image/png` or `image/webp`) or 404 |
| PUT | `/hooks/observation/Observation/:id` | Internal: FHIR rest-hook target for the Observation Subscription (HAPI delivers each match as a PUT of the Observation); answers 204. Not reachable through the public proxy |

### `POST /alerts/:id/acknowledge` body

```ts
{
  clinicId: string;   // must be a clinic that was sent this alert
  action: AckAction;
  note?: string;      // up to 500 characters
}
```

Creates a FHIR `Communication` with `inResponseTo` the alert's own `Communication` to that clinic,
`sender` the clinic `Organization`, `topic` the coded action and the note as its payload. Replies are
kept as separate resources rather than on the `DetectedIssue`, which a later evaluation rewrites in place.

When the request carries a SMART access token for that clinic, the API also writes a `Provenance`
targeting the reply: author `Practitioner/<id>` on behalf of the clinic `Organization`, enterer the
`PractitionerRole`, tagged `alert-response#smart-signed`. The reply then reads back with
`signedBy: { name, fhirUser, provenance }` (public FHIR URLs). Without a token the open demo still accepts replies, unsigned.

### `POST /reports` body

```ts
{
  siteId: string;
  indicator: string;         // Indicator.id
  value: number | Presence;  // number for quantity, Presence for presence
  observedAt?: string;       // ISO 8601; defaults to now if omitted
  reporter: string;          // display name, 1–120 chars
  note?: string;             // up to 1000 chars
  photo?: string;            // optional data URL (image/jpeg, image/png or image/webp), at most 1.5 MB decoded; the client downscales first
}
```

A photo is stored as a FHIR `Media` resource (content in a `Binary`), and the Observation references it through `derivedFrom`. Citizens are asked not to photograph people.

### FHIR agent and MCP tools

```ts
interface AgentStep {
  tool: string;              // one of the tools below
  args: Record<string, unknown>;
  summary: string;           // one line, e.g. "Found 1 active alert"
  fhirUrls: string[];        // the public /fhir searches the tool ran
  error?: boolean;           // the tool refused the call (bad arguments, blocked search)
}

interface AgentAnswer {
  question: string;
  answer: string;            // plain text; may use "- " bullets and **bold**
  steps: AgentStep[];        // in the order the model called them
  model: string;
  answeredAt: string;        // ISO 8601
}
```

| Tool | Arguments | Returns |
|---|---|---|
| `list_sites` | none | Every stream site with its latest reading per indicator and its active alerts |
| `list_clinics` | none | Every clinic and the sites it serves |
| `list_alerts` | `siteId?`, `clinicId?` | Active alerts (up to 20) with reasons, what to watch for and clinic replies |
| `get_trends` | `days?` (7–90) | The `Trends` rollup |
| `site_observations` | `siteId`, `indicator?`, `days?` (1–90, default 14) | Citizen readings at one site, newest first |
| `search_fhir` | `resourceType`, `params?` | A guarded FHIR search: only Location, Observation, DetectedIssue, Communication, Organization, HealthcareService, Group and Provenance, only listed search parameters, `_count` at most 20, results trimmed |

The tools only read. The agent is told to answer from tool results only and to give no clinical
advice. It gets at most 6 rounds of tool calls (4 calls a round) before it must answer.

Errors use `{ error: string, details?: unknown }` with 400 (validation), 404 (unknown site or indicator), 502 (FHIR server rejected the resource).
