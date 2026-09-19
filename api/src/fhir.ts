import { config } from "./config.js";

const FHIR_JSON = "application/fhir+json";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.fhirBaseUrl}${path}`, {
    ...init,
    headers: { Accept: FHIR_JSON, "Content-Type": FHIR_JSON, ...init?.headers },
    signal: AbortSignal.timeout(30_000),
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

type ResourceOf<K extends fhir4.FhirResource["resourceType"]> = Extract<fhir4.FhirResource, { resourceType: K }>;
type SearchParams = Record<string, string | number>;

// Search returning the matching resources of `type` (one page; callers set _count). With
// `_include`, the included resources come back in the `included` list.
async function search<K extends fhir4.FhirResource["resourceType"]>(type: K, params: SearchParams = {}) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  // no-cache: HAPI otherwise reuses identical search results for up to a minute, hiding fresh alerts.
  const bundle = await request<fhir4.Bundle>(`/${type}?${query}`, { headers: { "Cache-Control": "no-cache" } });
  const resources = (bundle.entry ?? []).flatMap((e) => (e.resource ? [e.resource] : []));
  return {
    matches: resources.filter((r): r is ResourceOf<K> => r.resourceType === type),
    included: resources.filter((r) => r.resourceType !== type),
  };
}

export const fhir = {
  capabilities: () => request<fhir4.CapabilityStatement>("/metadata?_summary=true"),
  create: <T extends fhir4.Resource>(resource: T) =>
    request<T>(`/${resource.resourceType}`, { method: "POST", body: JSON.stringify(resource) }),
  update: <T extends fhir4.Resource>(resource: T & { id: string }) =>
    request<T>(`/${resource.resourceType}/${resource.id}`, { method: "PUT", body: JSON.stringify(resource) }),
  read: async <K extends fhir4.FhirResource["resourceType"]>(type: K, id: string) => {
    try {
      return await request<ResourceOf<K>>(`/${type}/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof FhirError && (err.status === 404 || err.status === 410)) return undefined;
      throw err;
    }
  },
  search,
  transaction: (bundle: fhir4.Bundle) =>
    request<fhir4.Bundle>("/", { method: "POST", body: JSON.stringify(bundle) }),
};
