export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org").replace(/\/$/, "");
export const FHIR_URL = `${API_URL}/fhir`;
