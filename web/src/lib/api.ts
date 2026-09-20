import type { AcknowledgeInput, AlertFilter, Api, ReportInput } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org").replace(/\/$/, "");
export const FHIR_URL = `${API_URL}/fhir`;
export const MOCK = process.env.NEXT_PUBLIC_API_MOCK === "1";
export const REPO_URL = "https://github.com/Sarcastic-Soul/stream-to-clinic";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof body?.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.details);
  }
  return body as T;
}

const enc = encodeURIComponent;

const httpApi: Api = {
  getHealth: () => request("/health"),
  getIndicators: () => request("/indicators"),
  getSites: () => request("/sites"),
  getSite: (id) => request(`/sites/${enc(id)}`),
  getSiteBundle: (id) => request(`/sites/${enc(id)}/bundle`),
  createReport: (input: ReportInput) =>
    request("/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  getClinics: () => request("/clinics"),
  getAlerts: (filter: AlertFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.clinicId) params.set("clinicId", filter.clinicId);
    if (filter.siteId) params.set("siteId", filter.siteId);
    const query = params.size ? `?${params}` : "";
    return request(`/alerts${query}`);
  },
  getAlert: (id) => request(`/alerts/${enc(id)}`),
  acknowledgeAlert: (id, input: AcknowledgeInput) =>
    request(`/alerts/${enc(id)}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  getTrends: (days?: number) => request(`/trends${days ? `?days=${days}` : ""}`),
};

// The mock is only bundled into the chunk loaded when NEXT_PUBLIC_API_MOCK=1.
const client = (): Promise<Api> =>
  MOCK ? import("./mock-api").then((m) => m.mockApi) : Promise.resolve(httpApi);

export const api: Api = {
  getHealth: () => client().then((c) => c.getHealth()),
  getIndicators: () => client().then((c) => c.getIndicators()),
  getSites: () => client().then((c) => c.getSites()),
  getSite: (id) => client().then((c) => c.getSite(id)),
  getSiteBundle: (id) => client().then((c) => c.getSiteBundle(id)),
  createReport: (input) => client().then((c) => c.createReport(input)),
  getClinics: () => client().then((c) => c.getClinics()),
  getAlerts: (filter) => client().then((c) => c.getAlerts(filter)),
  getAlert: (id) => client().then((c) => c.getAlert(id)),
  acknowledgeAlert: (id, input) => client().then((c) => c.acknowledgeAlert(id, input)),
  getTrends: (days) => client().then((c) => c.getTrends(days)),
};

export const fhirObservationUrl = (id: string) => `${FHIR_URL}/Observation/${enc(id)}`;
export const siteBundleUrl = (id: string) => `${API_URL}/sites/${enc(id)}/bundle`;
