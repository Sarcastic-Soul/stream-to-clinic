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
  fhir: { detectedIssue: string; communications: string[] };  // public /fhir URLs
}
```

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ status: "ok", fhir: "4.0.1" }` or 503 |
| GET | `/indicators` | `Indicator[]` |
| GET | `/sites` | `SiteSummary[]` |
| GET | `/sites/:id` | `SiteDetail` or 404 |
| POST | `/reports` | `201 { observation: ObservationSummary, fhirUrl: string, alerts: AlertSummary[] }` — `alerts` lists alerts raised or updated by this report |
| GET | `/clinics` | `ClinicSummary[]` |
| GET | `/alerts?clinicId=&siteId=` | Active `AlertSummary[]`, newest first, both filters optional. `clinicId` returns only alerts sent to that clinic, so environmental-only risks (low oxygen) are excluded |
| GET | `/alerts/:id` | `AlertSummary` (active or closed) or 404 |
| GET | `/photos/:id` | The photo bytes (`image/jpeg`, `image/png` or `image/webp`) or 404 |
| PUT | `/hooks/observation/Observation/:id` | Internal: FHIR rest-hook target for the Observation Subscription (HAPI delivers each match as a PUT of the Observation); answers 204. Not reachable through the public proxy |

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
