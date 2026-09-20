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
  direction: TrendDirection;  // "steady" unless the change clears a tenth of the earlier mean
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
```

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ status: "ok", fhir: "4.0.1" }` or 503 |
| GET | `/indicators` | `Indicator[]` |
| GET | `/sites` | `SiteSummary[]` |
| GET | `/sites/:id` | `SiteDetail` or 404 |
| GET | `/sites/:id/bundle` | FHIR R4 `Bundle` (type `collection`, `application/fhir+json`, sent as a `<siteId>-bundle.json` download) or 404. Contains the site `Location` and its water body, the district `Group` and its health-measure baselines, the serving clinics (`Organization`, `HealthcareService`), the last 30 days of citizen `Observation`s (up to 200) with their photo `Media` (the `Binary` stays a link), and the site's `DetectedIssue`s (active and closed) with their `Communication`s. `fullUrl`s are public `/fhir` URLs |
| POST | `/reports` | `201 { observation: ObservationSummary, fhirUrl: string, alerts: AlertSummary[] }` — `alerts` lists alerts raised or updated by this report. Also writes a FHIR `Provenance` naming the reporter as author and the app as assembler, targeting the `Observation` (and its photo `Media`); a failed lineage write is logged, never fatal |
| GET | `/clinics` | `ClinicSummary[]` |
| GET | `/alerts?clinicId=&siteId=` | Active `AlertSummary[]`, newest first, both filters optional. `clinicId` returns only alerts sent to that clinic, so environmental-only risks (low oxygen) are excluded |
| GET | `/alerts/:id` | `AlertSummary` (active or closed) or 404 |
| POST | `/alerts/:id/acknowledge` | `201 AlertSummary` — a notified clinic reports what it did. 404 for an unknown alert or clinic, 409 if that clinic was not notified about this alert |
| GET | `/trends?days=` | `Trends` — `days` is an integer between 7 and 90, default 28. Counts citizen `Observation`s and active `DetectedIssue`s per site and per region, with a daily series and a direction per indicator, and the district health baselines alongside |
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

Errors use `{ error: string, details?: unknown }` with 400 (validation), 404 (unknown site or indicator), 502 (FHIR server rejected the resource).
