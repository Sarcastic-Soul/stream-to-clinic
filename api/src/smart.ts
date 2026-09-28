// A small SMART App Launch 2.0 authorization server, so the clinic view runs as a SMART on FHIR app:
// discovery at <fhir>/.well-known/smart-configuration, an authorize endpoint with a demo clinician
// sign-in, a token endpoint for public clients with PKCE (S256), and a simulated EHR that starts
// the EHR launch. Tokens are RS256 JWTs; the signing key is created on first use and kept in the
// API's data directory, so it never passes through the repository or the deploy settings.
//
// The public demo FHIR server stays readable without a token, so judges can open every link. The
// token carries who signed in (fhirUser) and for which clinic (fhirContext), and the API checks it
// when a signed-in clinic replies to an alert.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { fhir } from "./fhir.js";

export const SMART_CLIENT_ID = "stream-to-clinic-clinic-app";
const CODE_TTL_MS = 2 * 60_000;
const LAUNCH_TTL_S = 10 * 60;
const TOKEN_TTL_S = 60 * 60;
const MAX_CODES = 1000;

const issuer = () => `${config.publicApiUrl}/smart`;
const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

// ---- Signing key and JWTs ----

interface SigningKey {
  privateKey: KeyObject;
  publicKey: KeyObject;
  kid: string;
}

let keyPromise: Promise<SigningKey> | undefined;

export async function loadSigningKey(file = path.join(config.dataDir, "smart-signing-key.pem")): Promise<SigningKey> {
  let pem: string;
  try {
    pem = await readFile(file, "utf8");
  } catch {
    pem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, pem, { mode: 0o600 });
  }
  const privateKey = createPrivateKey(pem);
  const publicKey = createPublicKey(privateKey);
  const kid = createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("base64url").slice(0, 16);
  return { privateKey, publicKey, kid };
}

const signingKey = () => (keyPromise ??= loadSigningKey());

export function signJwt(payload: Record<string, unknown>, key: SigningKey): string {
  const data = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid }))}.${b64url(JSON.stringify(payload))}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), key.privateKey).toString("base64url")}`;
}

/** The payload of a JWT we signed that has not expired, or undefined. */
export function verifyJwt(token: string, key: SigningKey, now = Date.now()): Record<string, unknown> | undefined {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return undefined;
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString()) as { alg?: string; kid?: string };
    if (head.alg !== "RS256" || head.kid !== key.kid) return undefined;
    if (!verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), key.publicKey, Buffer.from(signature, "base64url"))) return undefined;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return undefined;
    if (claims.iss !== issuer()) return undefined;
    return claims;
  } catch {
    return undefined;
  }
}

export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

// ---- Clients, scopes and clinicians ----

/** The clinic app is a public client; it may only be sent back to its own pages. */
export const allowedRedirects = () => config.corsOrigins.map((origin) => `${origin}/smart/callback`);
const allowedLaunchUrls = () => config.corsOrigins.map((origin) => `${origin}/smart/launch`);

const SCOPE = /^(openid|fhirUser|launch|online_access|user\/(\*|[A-Z][A-Za-z]+)\.(c?r?u?d?s?|read|write|\*))$/;
/** The requested scopes this server can grant; anything else is dropped, as SMART allows. */
export const grantScopes = (requested: string) =>
  requested
    .split(/\s+/)
    .filter((s) => SCOPE.test(s))
    .join(" ");

export interface Clinician {
  roleId: string;
  practitionerId: string;
  name: string;
  clinicId: string;
  clinicName: string;
}

async function loadClinicians(): Promise<Clinician[]> {
  const { matches } = await fhir.search("PractitionerRole", { active: "true", _count: 50 });
  return matches.flatMap((role) => {
    const practitionerId = role.practitioner?.reference?.replace("Practitioner/", "");
    const clinicId = role.organization?.reference?.replace("Organization/", "");
    if (!role.id || !practitionerId || !clinicId) return [];
    return [{ roleId: role.id, practitionerId, name: role.practitioner?.display ?? practitionerId, clinicId, clinicName: role.organization?.display ?? clinicId }];
  });
}

// ---- Authorization requests ----

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  aud?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  launch?: string;
}

type Checked = { ok: true; params: Required<Omit<AuthorizeParams, "launch">> & { launch?: string } } | { ok: false; error: string; redirect?: string };

/** Validates an authorize request. Errors found before the redirect URI is trusted are shown, not redirected. */
export function checkAuthorize(p: AuthorizeParams): Checked {
  if (p.client_id !== SMART_CLIENT_ID) return { ok: false, error: "Unknown client_id" };
  if (!p.redirect_uri || !allowedRedirects().includes(p.redirect_uri)) return { ok: false, error: "redirect_uri is not registered for this client" };
  const back = (error: string) => {
    const url = new URL(p.redirect_uri!);
    url.searchParams.set("error", "invalid_request");
    url.searchParams.set("error_description", error);
    if (p.state) url.searchParams.set("state", p.state);
    return { ok: false as const, error, redirect: url.toString() };
  };
  if (p.response_type !== "code") return back("response_type must be code");
  if (!p.state) return back("state is required");
  if (p.aud?.replace(/\/$/, "") !== config.publicFhirUrl) return back(`aud must be ${config.publicFhirUrl}`);
  if (p.code_challenge_method !== "S256" || !p.code_challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) {
    return back("PKCE with code_challenge_method S256 is required");
  }
  return {
    ok: true,
    params: {
      response_type: "code",
      client_id: p.client_id,
      redirect_uri: p.redirect_uri,
      scope: grantScopes(p.scope ?? ""),
      state: p.state,
      aud: config.publicFhirUrl,
      code_challenge: p.code_challenge,
      code_challenge_method: "S256",
      ...(p.launch ? { launch: p.launch } : {}),
    },
  };
}

interface Grant {
  redirectUri: string;
  challenge: string;
  scope: string;
  clinician: Clinician;
  expires: number;
}

const codes = new Map<string, Grant>();

function issueCode(grant: Omit<Grant, "expires">): string {
  const now = Date.now();
  for (const [code, g] of codes) if (g.expires < now) codes.delete(code);
  if (codes.size >= MAX_CODES) codes.delete(codes.keys().next().value!);
  const code = randomBytes(24).toString("base64url");
  codes.set(code, { ...grant, expires: now + CODE_TTL_MS });
  return code;
}

function redirectWithCode(reply: FastifyReply, params: { redirect_uri: string; state: string }, code: string) {
  const url = new URL(params.redirect_uri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", params.state);
  return reply.code(303).header("Location", url.toString()).send();
}

// ---- Token checks for API routes ----

export interface SmartUser {
  practitionerId: string;
  roleId: string;
  clinicId: string;
  name: string;
  scope: string;
}

/**
 * The signed-in clinician behind a request, from its Bearer token. undefined when there is no
 * Authorization header; "invalid" when there is one we did not issue or that has expired.
 */
export async function smartUser(req: FastifyRequest): Promise<SmartUser | "invalid" | undefined> {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const token = /^Bearer (.+)$/.exec(header)?.[1];
  const claims = token ? verifyJwt(token, await signingKey()) : undefined;
  if (!claims || claims.token_use !== "access") return "invalid";
  return {
    practitionerId: String(claims.sub),
    roleId: String(claims.practitioner_role),
    clinicId: String(claims.clinic),
    name: String(claims.name),
    scope: String(claims.scope),
  };
}

// ---- Pages ----

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const SCOPE_TEXT: [RegExp, string][] = [
  [/^openid$|^fhirUser$/, "Know which clinician you are"],
  [/^launch$/, "Open in the context of your EHR session"],
  [/^user\/.*\.(c?r|read)/, "Read stream alerts and clinic data you can see"],
  [/^user\/Communication\.c/, "Send your clinic's replies to alerts"],
];

function page(title: string, body: string, formTargets: string[] = []) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>
:root{--bg:#f0f7fb;--card:#fff;--fg:#0f172a;--muted:#475569;--line:#dbe7ef;--accent:#0369a1;--accent2:#06b6d4}
@media (prefers-color-scheme:dark){:root{--bg:#07131c;--card:#0d1f2b;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e3a4c;--accent:#38bdf8;--accent2:#22d3ee}}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(ellipse at top,color-mix(in oklab,var(--accent2) 22%,transparent),transparent 60%),var(--bg);color:var(--fg);min-height:100vh;display:grid;place-items:center;padding:24px 16px}
main{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 30px 60px -30px rgb(2 32 51 / .35)}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;color:var(--accent);font-size:13px;letter-spacing:.14em;text-transform:uppercase}
.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;color:#fff;font-size:18px}
h1{font-size:24px;line-height:1.2;margin:14px 0 6px}p{color:var(--muted);margin:0 0 14px}
ul.scopes{list-style:none;padding:0;margin:0 0 18px;display:grid;gap:6px}ul.scopes li{font-size:14px;padding-left:22px;position:relative}ul.scopes li:before{content:"✓";position:absolute;left:0;color:#10b981;font-weight:700}
button,.btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;cursor:pointer;border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-top:10px;background:var(--card);transition:border-color .2s,transform .2s}
button:hover,.btn:hover,button:focus-visible,.btn:focus-visible{border-color:var(--accent);transform:translateY(-1px)}
.avatar{width:40px;height:40px;border-radius:50%;background:color-mix(in oklab,var(--accent) 16%,transparent);color:var(--accent);display:grid;place-items:center;font-weight:700;flex:none}
.who b{display:block}.who span{font-size:13px;color:var(--muted)}
.primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:0;justify-content:center;font-weight:600}
small{display:block;margin-top:18px;color:var(--muted);font-size:12px}code{font-size:12px}
</style></head><body><main>${body}</main></body></html>`;
  const actions = ["'self'", ...new Set(formTargets.map((u) => new URL(u).origin))].join(" ");
  return { html, csp: `default-src 'none'; style-src 'unsafe-inline'; form-action ${actions}; frame-ancestors 'none'; base-uri 'none'` };
}

const initials = (name: string) =>
  name
    .replace(/^Dr\s+/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

function signInPage(params: Record<string, string>, clinicians: Clinician[]) {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`)
    .join("");
  const scopes = [...new Set(params.scope.split(" ").flatMap((s) => SCOPE_TEXT.filter(([re]) => re.test(s)).map(([, text]) => text)))];
  return page(
    "Sign in · Stream-to-Clinic",
    `<div class="brand"><span class="logo">💧</span>SMART on FHIR sign-in</div>
<h1>Sign in to the clinic app</h1>
<p><b>Stream-to-Clinic</b> is asking to:</p>
<ul class="scopes">${scopes.map((s) => `<li>${escape(s)}</li>`).join("")}</ul>
<p>Choose a demo clinician. There are no passwords: these are fictional users for the hackathon demo.</p>
<form method="post" action="/smart/authorize">${hidden}
${clinicians
  .map(
    (c) => `<button type="submit" name="practitioner_role" value="${escape(c.roleId)}" data-testid="smart-clinician" data-clinic="${escape(c.clinicId)}">
<span class="avatar">${escape(initials(c.name))}</span><span class="who"><b>${escape(c.name)}</b><span>${escape(c.clinicName)}</span></span></button>`,
  )
  .join("\n")}
</form>
<small>Authorization server for <code>${escape(config.publicFhirUrl)}</code>. Code flow with PKCE (S256); tokens are RS256 JWTs.</small>`,
    [params.redirect_uri],
  );
}

function errorPage(message: string) {
  return page("Sign-in problem · Stream-to-Clinic", `<div class="brand"><span class="logo">💧</span>SMART on FHIR</div><h1>This sign-in request cannot be used</h1><p>${escape(message)}</p>`);
}

function ehrPage(clinician: Clinician, launchUrl: string) {
  return page(
    "Demo EHR · Stream-to-Clinic",
    `<div class="brand"><span class="logo">🩺</span>Demo EHR</div>
<h1>${escape(clinician.clinicName)}</h1>
<p>Signed in as <b>${escape(clinician.name)}</b>. This page stands in for the clinic's electronic health record, which launches apps with SMART on FHIR.</p>
<p style="margin-top:18px;font-weight:600;color:var(--fg)">Apps</p>
<a class="btn primary" id="ehr-launch" href="${escape(launchUrl)}">Open Stream-to-Clinic alerts</a>
<small>The EHR passes the app a signed <code>launch</code> token and the FHIR server address (<code>iss</code>). The app then asks <code>/smart/authorize</code> for access, and gets this clinic as its context.</small>`,
  );
}

function sendPage(reply: FastifyReply, status: number, { html, csp }: { html: string; csp: string }) {
  return reply.code(status).type("text/html; charset=utf-8").header("Content-Security-Policy", csp).header("Cache-Control", "no-store").send(html);
}

// ---- Routes ----

export function registerSmart(app: FastifyInstance) {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 16 * 1024 }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  // Caddy sends this one path under /fhir to the API; everything else under /fhir is HAPI.
  app.get("/fhir/.well-known/smart-configuration", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return {
      issuer: issuer(),
      jwks_uri: `${issuer()}/jwks.json`,
      authorization_endpoint: `${issuer()}/authorize`,
      token_endpoint: `${issuer()}/token`,
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "fhirUser", "launch", "user/*.rs", "user/Communication.c"],
      capabilities: ["launch-ehr", "launch-standalone", "client-public", "sso-openid-connect", "permission-user", "permission-v2"],
    };
  });

  app.get("/smart/jwks.json", async () => {
    const key = await signingKey();
    return { keys: [{ ...(key.publicKey.export({ format: "jwk" }) as object), kid: key.kid, alg: "RS256", use: "sig" }] };
  });

  app.get<{ Querystring: AuthorizeParams }>("/smart/authorize", async (req, reply) => {
    const checked = checkAuthorize(req.query);
    if (!checked.ok) return checked.redirect ? reply.code(303).header("Location", checked.redirect).send() : sendPage(reply, 400, errorPage(checked.error));
    const { params } = checked;
    const clinicians = await loadClinicians();
    // EHR launch: the EHR already knows who is signed in, so there is no sign-in step.
    if (params.launch) {
      const launch = verifyJwt(params.launch, await signingKey());
      const clinician = launch?.token_use === "launch" ? clinicians.find((c) => c.roleId === launch.practitioner_role) : undefined;
      if (!clinician) return sendPage(reply, 400, errorPage("The launch token is not valid or has expired. Launch the app again from the EHR."));
      const code = issueCode({ redirectUri: params.redirect_uri, challenge: params.code_challenge, scope: params.scope, clinician });
      return redirectWithCode(reply, params, code);
    }
    return sendPage(reply, 200, signInPage(params, clinicians));
  });

  app.post<{ Body: AuthorizeParams & { practitioner_role?: string } }>("/smart/authorize", async (req, reply) => {
    const checked = checkAuthorize(req.body ?? {});
    if (!checked.ok) return checked.redirect ? reply.code(303).header("Location", checked.redirect).send() : sendPage(reply, 400, errorPage(checked.error));
    const clinician = (await loadClinicians()).find((c) => c.roleId === req.body.practitioner_role);
    if (!clinician) return sendPage(reply, 400, errorPage("Choose one of the demo clinicians."));
    const { params } = checked;
    const code = issueCode({ redirectUri: params.redirect_uri, challenge: params.code_challenge, scope: params.scope, clinician });
    return redirectWithCode(reply, params, code);
  });

  app.post<{ Body: Record<string, string | undefined> }>("/smart/token", async (req, reply) => {
    reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
    const body = req.body ?? {};
    const fail = (error: string, description: string) => reply.code(400).send({ error, error_description: description });
    if (body.grant_type !== "authorization_code") return fail("unsupported_grant_type", "Only authorization_code is supported");
    const grant = body.code ? codes.get(body.code) : undefined;
    if (body.code) codes.delete(body.code); // one use only, even when the rest of the request is wrong
    if (!grant || grant.expires < Date.now()) return fail("invalid_grant", "Unknown or expired code");
    if (body.client_id !== SMART_CLIENT_ID) return fail("invalid_client", "Unknown client_id");
    if (body.redirect_uri !== grant.redirectUri) return fail("invalid_grant", "redirect_uri does not match");
    if (!body.code_verifier || pkceChallenge(body.code_verifier) !== grant.challenge) return fail("invalid_grant", "PKCE code_verifier does not match");

    const key = await signingKey();
    const now = Math.floor(Date.now() / 1000);
    const { clinician, scope } = grant;
    const fhirUser = `${config.publicFhirUrl}/Practitioner/${clinician.practitionerId}`;
    const access = signJwt(
      {
        iss: issuer(),
        aud: config.publicFhirUrl,
        sub: clinician.practitionerId,
        client_id: SMART_CLIENT_ID,
        scope,
        fhirUser,
        practitioner_role: clinician.roleId,
        clinic: clinician.clinicId,
        name: clinician.name,
        token_use: "access",
        iat: now,
        exp: now + TOKEN_TTL_S,
        jti: randomBytes(12).toString("base64url"),
      },
      key,
    );
    const scopes = scope.split(" ");
    const idToken = scopes.includes("openid")
      ? signJwt({ iss: issuer(), aud: SMART_CLIENT_ID, sub: clinician.practitionerId, name: clinician.name, ...(scopes.includes("fhirUser") ? { fhirUser } : {}), iat: now, exp: now + TOKEN_TTL_S }, key)
      : undefined;
    return {
      access_token: access,
      token_type: "Bearer",
      expires_in: TOKEN_TTL_S,
      scope,
      ...(idToken ? { id_token: idToken } : {}),
      // SMART 2.1 launch context for things other than a patient: the clinic and the signed-in role.
      fhirContext: [{ reference: `Organization/${clinician.clinicId}` }, { reference: `PractitionerRole/${clinician.roleId}` }],
      need_patient_banner: false,
    };
  });

  // A stand-in EHR for the demo: shows the clinic's workspace and launches the app with a signed launch token.
  app.get<{ Querystring: { clinic?: string; app?: string } }>("/smart/ehr", async (req, reply) => {
    const launchUrl = req.query.app;
    if (!launchUrl || !allowedLaunchUrls().includes(launchUrl)) return sendPage(reply, 400, errorPage("Unknown app launch URL."));
    const clinicians = await loadClinicians();
    const clinician = clinicians.find((c) => c.clinicId === req.query.clinic) ?? clinicians[0];
    if (!clinician) return sendPage(reply, 503, errorPage("No demo clinicians are set up yet."));
    const now = Math.floor(Date.now() / 1000);
    const launch = signJwt({ iss: issuer(), token_use: "launch", practitioner_role: clinician.roleId, iat: now, exp: now + LAUNCH_TTL_S }, await signingKey());
    const url = new URL(launchUrl);
    url.searchParams.set("iss", config.publicFhirUrl);
    url.searchParams.set("launch", launch);
    return sendPage(reply, 200, ehrPage(clinician, url.toString()));
  });
}
