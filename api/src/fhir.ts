import { config } from "./config.js";

const FHIR_JSON = "application/fhir+json";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.fhirBaseUrl}${path}`, {
    ...init,
    headers: { Accept: FHIR_JSON, "Content-Type": FHIR_JSON, ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json()) as T;
  if (!res.ok) throw new FhirError(res.status, body);
  return body;
}

export class FhirError extends Error {
  constructor(
    readonly status: number,
    readonly outcome: unknown,
  ) {
    super(`FHIR server responded ${status}`);
  }
}

export const fhir = {
  capabilities: () => request<fhir4.CapabilityStatement>("/metadata?_summary=true"),
  create: <T extends fhir4.Resource>(resource: T) =>
    request<T>(`/${resource.resourceType}`, { method: "POST", body: JSON.stringify(resource) }),
};
