// Mirrors docs/API.md. Change both together.

export type RiskLevel = "none" | "low" | "medium" | "high";
export type IndicatorKind = "quantity" | "presence";
export type Presence = "absent" | "present" | "abundant";
export type RiskKind = "algal-bloom" | "sewage-overflow" | "mosquito-breeding" | "low-oxygen";

export interface Indicator {
  id: string;
  display: string;
  kind: IndicatorKind;
  unit?: string;
  unitLabel?: string;
  min?: number;
  max?: number;
}

export interface ObservationSummary {
  id: string;
  indicator: string;
  value: number | Presence;
  unit?: string;
  observedAt: string;
  reporter: string;
  photoUrl?: string;
}

export interface SiteSummary {
  id: string;
  name: string;
  waterBody: string;
  region: string;
  lat: number;
  lon: number;
  riskLevel: RiskLevel;
  latest: ObservationSummary[];
}

export interface SiteDetail extends SiteSummary {
  observations: ObservationSummary[];
  alerts: AlertSummary[];
  clinics: ClinicSummary[];
}

export interface ClinicSummary {
  id: string;
  name: string;
  city: string;
  siteIds: string[];
}

export interface AlertSummary {
  id: string;
  risk: RiskKind;
  title: string;
  level: RiskLevel;
  siteId: string;
  siteName: string;
  createdAt: string;
  // Closed once a later evaluation no longer meets the rule; lists only return active alerts.
  status: "active" | "closed";
  closedAt?: string;
  reasons: string[];
  watchFor: string;
  // Optional here so alerts raised before the narrative existed still render.
  narrative?: string[];
  evidence: string[];
  fhir: { detectedIssue: string; communications: string[] };
}

export interface Health {
  status: "ok";
  fhir: string;
}

export interface ReportInput {
  siteId: string;
  indicator: string;
  value: number | Presence;
  observedAt?: string;
  reporter: string;
  note?: string;
  photo?: string; // data URL, downscaled on the device first
}

export interface ReportResult {
  observation: ObservationSummary;
  fhirUrl: string;
  alerts: AlertSummary[];
}

export interface AlertFilter {
  clinicId?: string;
  siteId?: string;
}

export interface Api {
  getHealth(): Promise<Health>;
  getIndicators(): Promise<Indicator[]>;
  getSites(): Promise<SiteSummary[]>;
  getSite(id: string): Promise<SiteDetail>;
  createReport(input: ReportInput): Promise<ReportResult>;
  getClinics(): Promise<ClinicSummary[]>;
  getAlerts(filter?: AlertFilter): Promise<AlertSummary[]>;
  getAlert(id: string): Promise<AlertSummary>;
}
