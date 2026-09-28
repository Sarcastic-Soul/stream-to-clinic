import type { AcknowledgeInput, AlertFilter, AlertSummary, Api, LiveAlertHandlers, ReportInput } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org").replace(/\/$/, "");
export const FHIR_URL = `${API_URL}/fhir`;
// Remote MCP server serving the same read-only tools as the agent.
export const MCP_URL = `${API_URL}/mcp`;
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
  const body = res.status === 204 ? null : await res.json().catch(() => null);
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
  getReportJourney: (id) => request(`/reports/${enc(id)}/journey`),
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
  requestAdvisory: (id: string) => request(`/alerts/${enc(id)}/advisory`, { method: "POST" }),
  subscribeAlerts: (clinicId, { onAlert, onStatus }: LiveAlertHandlers) => {
    const source = new EventSource(`${API_URL}/events${clinicId ? `?clinicId=${enc(clinicId)}` : ""}`);
    onStatus?.("connecting");
    source.addEventListener("ready", () => onStatus?.("live"));
    source.addEventListener("alert", (event) => onAlert(JSON.parse((event as MessageEvent<string>).data) as AlertSummary));
    // EventSource retries by itself; the indicator shows the gap until it is back.
    source.onerror = () => onStatus?.(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    return () => source.close();
  },
  getPushKey: () => request("/push/key"),
  subscribePush: (clinicId, subscription) => request("/push/subscriptions", json({ clinicId, subscription })),
  unsubscribePush: (endpoint) => request("/push/unsubscribe", json({ endpoint })),
  testPush: (endpoint) => request("/push/test", json({ endpoint })),
  askAgent: (question) => request("/agent/ask", json({ question })),
};

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

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
  getReportJourney: (id) => client().then((c) => c.getReportJourney(id)),
  getClinics: () => client().then((c) => c.getClinics()),
  getAlerts: (filter) => client().then((c) => c.getAlerts(filter)),
  getAlert: (id) => client().then((c) => c.getAlert(id)),
  acknowledgeAlert: (id, input) => client().then((c) => c.acknowledgeAlert(id, input)),
  getTrends: (days) => client().then((c) => c.getTrends(days)),
  requestAdvisory: (id) => client().then((c) => c.requestAdvisory(id)),
  subscribeAlerts: (clinicId, handlers) => {
    let close: (() => void) | undefined;
    let closed = false;
    client().then((c) => {
      if (!closed) close = c.subscribeAlerts(clinicId, handlers);
    });
    return () => {
      closed = true;
      close?.();
    };
  },
  getPushKey: () => client().then((c) => c.getPushKey()),
  subscribePush: (clinicId, subscription) => client().then((c) => c.subscribePush(clinicId, subscription)),
  unsubscribePush: (endpoint) => client().then((c) => c.unsubscribePush(endpoint)),
  testPush: (endpoint) => client().then((c) => c.testPush(endpoint)),
  askAgent: (question) => client().then((c) => c.askAgent(question)),
};

export const fhirObservationUrl = (id: string) => `${FHIR_URL}/Observation/${enc(id)}`;
export const siteBundleUrl = (id: string) => `${API_URL}/sites/${enc(id)}/bundle`;
