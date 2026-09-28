// The clinic view as a SMART on FHIR app (SMART App Launch 2.0): a public client using the
// authorization code flow with PKCE (S256). Works for both launches the standard defines:
// - EHR launch: the clinic's EHR opens /smart/launch?iss=...&launch=..., and the clinic in the
//   token's fhirContext is the one the EHR had open.
// - Standalone launch: the clinic app starts it itself and the clinician signs in.
// Small enough to write by hand, so the page carries no extra client library.
import { FHIR_URL } from "./endpoints";

export const SMART_CLIENT_ID = "stream-to-clinic-clinic-app";
const PENDING_KEY = "stream-to-clinic.smart-pending";
const SESSION_KEY = "stream-to-clinic.smart";
export const SMART_EVENT = "stream-to-clinic:smart";

export interface SmartSession {
  accessToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  scope: string;
  clinicId: string;
  roleId?: string;
  practitionerName: string;
  /** Absolute URL of the signed-in Practitioner on the FHIR server. */
  fhirUser?: string;
  launch: "ehr" | "standalone";
}

interface Pending {
  state: string;
  verifier: string;
  tokenEndpoint: string;
  redirectUri: string;
  launch: SmartSession["launch"];
}

export class SmartError extends Error {}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const random = (length: number) => b64url(crypto.getRandomValues(new Uint8Array(length)));

function store(kind: "session" | "local", key: string, value: string | null) {
  try {
    const s = kind === "session" ? window.sessionStorage : window.localStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage blocked: the sign-in then lasts only as long as this page.
  }
}
function load(kind: "session" | "local", key: string): string | null {
  try {
    return (kind === "session" ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

/** Only our own FHIR server may start a launch, so a token is never sent anywhere else. */
export const isOwnServer = (iss: string) => iss.replace(/\/$/, "") === FHIR_URL;

/** Starts a launch: discovers the endpoints, then sends the browser to the authorize page. */
export async function startSmartLaunch({ iss = FHIR_URL, launch }: { iss?: string; launch?: string } = {}) {
  if (!isOwnServer(iss)) throw new SmartError(`This app only connects to ${FHIR_URL}, not ${iss}.`);
  const res = await fetch(`${FHIR_URL}/.well-known/smart-configuration`, { headers: { Accept: "application/json" } }).catch(() => undefined);
  if (!res?.ok) throw new SmartError("Could not reach the FHIR server's SMART configuration.");
  const conf = (await res.json()) as { authorization_endpoint: string; token_endpoint: string; code_challenge_methods_supported?: string[] };
  if (!conf.code_challenge_methods_supported?.includes("S256")) throw new SmartError("The server does not support PKCE (S256).");

  const verifier = random(32);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const pending: Pending = {
    state: random(16),
    verifier,
    tokenEndpoint: conf.token_endpoint,
    redirectUri: `${window.location.origin}/smart/callback`,
    launch: launch ? "ehr" : "standalone",
  };
  store("session", PENDING_KEY, JSON.stringify(pending));

  const url = new URL(conf.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: SMART_CLIENT_ID,
    redirect_uri: pending.redirectUri,
    scope: `openid fhirUser${launch ? " launch" : ""} user/*.rs user/Communication.c`,
    state: pending.state,
    aud: FHIR_URL,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(launch ? { launch } : {}),
  }).toString();
  window.location.assign(url.toString());
}

function claims(jwt: string | undefined): Record<string, unknown> {
  try {
    const payload = jwt?.split(".")[1] ?? "";
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Finishes a launch on /smart/callback: checks state, swaps the code for a token, and saves the session. */
export async function completeSmartLaunch(params: URLSearchParams): Promise<SmartSession> {
  const raw = load("session", PENDING_KEY);
  store("session", PENDING_KEY, null);
  const pending = raw ? (JSON.parse(raw) as Pending) : undefined;
  if (params.get("error")) throw new SmartError(params.get("error_description") ?? params.get("error")!);
  if (!pending || params.get("state") !== pending.state) throw new SmartError("This sign-in was not started here, or was already used. Start again.");
  const code = params.get("code");
  if (!code) throw new SmartError("The server did not send an authorization code.");

  const res = await fetch(pending.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      client_id: SMART_CLIENT_ID,
      code_verifier: pending.verifier,
    }),
  }).catch(() => undefined);
  const body = (await res?.json().catch(() => undefined)) as
    | { access_token?: string; expires_in?: number; scope?: string; id_token?: string; fhirContext?: { reference?: string }[]; error_description?: string }
    | undefined;
  if (!res?.ok || !body?.access_token) throw new SmartError(body?.error_description ?? "The token request failed.");

  const context = (type: string) => body.fhirContext?.find((c) => c.reference?.startsWith(`${type}/`))?.reference?.slice(type.length + 1);
  const clinicId = context("Organization");
  if (!clinicId) throw new SmartError("The token did not say which clinic you work for.");
  const id = claims(body.id_token);
  const session: SmartSession = {
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope ?? "",
    clinicId,
    roleId: context("PractitionerRole"),
    practitionerName: typeof id.name === "string" ? id.name : "Signed-in clinician",
    ...(typeof id.fhirUser === "string" ? { fhirUser: id.fhirUser } : {}),
    launch: pending.launch,
  };
  store("session", SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SMART_EVENT));
  return session;
}

/** The saved session as stored text, for useSyncExternalStore (a string keeps the snapshot stable). */
export const smartSnapshot = () => load("session", SESSION_KEY);

export function parseSession(raw: string | null): SmartSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SmartSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function signOutSmart() {
  store("session", SESSION_KEY, null);
  window.dispatchEvent(new Event(SMART_EVENT));
}

/** The access token to send with a clinic's writes, when the signed-in clinician works there. */
export function smartTokenFor(clinicId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const session = parseSession(smartSnapshot());
  return session?.clinicId === clinicId ? session.accessToken : undefined;
}

/** The demo EHR page that launches this app for a clinic (served by the API). */
export const demoEhrUrl = (apiUrl: string, clinicId: string) =>
  `${apiUrl}/smart/ehr?${new URLSearchParams({ clinic: clinicId, app: `${window.location.origin}/smart/launch` })}`;
