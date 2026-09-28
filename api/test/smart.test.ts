import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import Fastify from "fastify";

// config is read at import time, so the data folder and the app's origin have to be set first.
process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "stc-smart-"));
process.env.CORS_ORIGINS = "https://app.example";
process.env.PUBLIC_FHIR_URL = "https://fhir.example/fhir";
process.env.PUBLIC_API_URL = "https://fhir.example";
const { SMART_CLIENT_ID, checkAuthorize, grantScopes, loadSigningKey, pkceChallenge, registerSmart, signJwt, smartUser, verifyJwt } = await import(
  "../src/smart.js"
);

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});
// The only FHIR read the SMART routes make: the demo clinicians.
globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "PractitionerRole",
            id: "role-clinic-a",
            practitioner: { reference: "Practitioner/gp-clinic-a", display: "Dr Eleni Demo (demo)" },
            organization: { reference: "Organization/clinic-a", display: "Clinic A (demo)" },
          },
        },
      ],
    }),
    { status: 200 },
  )) as typeof fetch;

const verifier = randomBytes(32).toString("base64url");
const authorize = {
  response_type: "code",
  client_id: SMART_CLIENT_ID,
  redirect_uri: "https://app.example/smart/callback",
  scope: "openid fhirUser launch user/*.rs user/Communication.c patient/*.* admin",
  state: "s1",
  aud: "https://fhir.example/fhir",
  code_challenge: pkceChallenge(verifier),
  code_challenge_method: "S256",
};

function makeApp() {
  const app = Fastify();
  registerSmart(app);
  app.get("/whoami", async (req) => (await smartUser(req)) ?? "anonymous");
  return app;
}

test("JWTs verify only with their own key and until they expire", async () => {
  const key = await loadSigningKey(join(process.env.DATA_DIR!, "a.pem"));
  const other = await loadSigningKey(join(process.env.DATA_DIR!, "b.pem"));
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ iss: "https://fhir.example/smart", sub: "x", exp: now + 60 }, key);
  assert.equal(verifyJwt(token, key)?.sub, "x");
  assert.equal(verifyJwt(token, other), undefined);
  assert.equal(verifyJwt(token, key, (now + 61) * 1000), undefined);
  const [h, , s] = token.split(".");
  const forged = `${h}.${Buffer.from(JSON.stringify({ iss: "https://fhir.example/smart", sub: "admin", exp: now + 60 })).toString("base64url")}.${s}`;
  assert.equal(verifyJwt(forged, key), undefined);
  // The same file gives the same key after a restart.
  assert.equal((await loadSigningKey(join(process.env.DATA_DIR!, "a.pem"))).kid, key.kid);
});

test("only scopes this server understands are granted", () => {
  assert.equal(grantScopes(authorize.scope), "openid fhirUser launch user/*.rs user/Communication.c");
});

test("authorize requests are checked before anything is redirected", () => {
  assert.equal(checkAuthorize(authorize).ok, true);
  const badRedirect = checkAuthorize({ ...authorize, redirect_uri: "https://evil.example/smart/callback" });
  assert.deepEqual(badRedirect, { ok: false, error: "redirect_uri is not registered for this client" });
  const noPkce = checkAuthorize({ ...authorize, code_challenge_method: "plain" });
  assert.equal(noPkce.ok, false);
  assert.match(!noPkce.ok ? noPkce.redirect! : "", /^https:\/\/app\.example\/smart\/callback\?error=invalid_request&.*state=s1/);
  assert.equal(checkAuthorize({ ...authorize, aud: "https://other.example/fhir" }).ok, false);
});

test("sign-in, code exchange with PKCE, and a token the API accepts", async () => {
  const app = makeApp();
  const page = await app.inject({ method: "GET", url: "/smart/authorize", query: authorize });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers["content-security-policy"] as string, /form-action 'self' https:\/\/app\.example/);
  assert.match(page.body, /Dr Eleni Demo \(demo\)/);

  const signIn = await app.inject({
    method: "POST",
    url: "/smart/authorize",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ ...authorize, practitioner_role: "role-clinic-a" }).toString(),
  });
  assert.equal(signIn.statusCode, 303);
  const back = new URL(signIn.headers.location as string);
  assert.equal(back.origin + back.pathname, authorize.redirect_uri);
  assert.equal(back.searchParams.get("state"), "s1");
  const code = back.searchParams.get("code")!;

  const exchange = (body: Record<string, string>) =>
    app.inject({ method: "POST", url: "/smart/token", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: new URLSearchParams(body).toString() });
  const form = { grant_type: "authorization_code", code, client_id: SMART_CLIENT_ID, redirect_uri: authorize.redirect_uri };

  const wrongVerifier = await exchange({ ...form, code_verifier: randomBytes(32).toString("base64url") });
  assert.equal(wrongVerifier.statusCode, 400);
  // A failed exchange burns the code, as the code may have leaked.
  assert.equal((await exchange({ ...form, code_verifier: verifier })).json().error, "invalid_grant");

  const again = await app.inject({
    method: "POST",
    url: "/smart/authorize",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ ...authorize, practitioner_role: "role-clinic-a" }).toString(),
  });
  const token = await exchange({ ...form, code: new URL(again.headers.location as string).searchParams.get("code")!, code_verifier: verifier });
  assert.equal(token.statusCode, 200);
  assert.equal(token.headers["cache-control"], "no-store");
  const body = token.json();
  assert.equal(body.token_type, "Bearer");
  assert.equal(body.scope, "openid fhirUser launch user/*.rs user/Communication.c");
  assert.deepEqual(body.fhirContext, [{ reference: "Organization/clinic-a" }, { reference: "PractitionerRole/role-clinic-a" }]);
  assert.ok(body.id_token);

  const me = await app.inject({ method: "GET", url: "/whoami", headers: { authorization: `Bearer ${body.access_token}` } });
  assert.equal(me.json().clinicId, "clinic-a");
  assert.equal(me.json().practitionerId, "gp-clinic-a");
  const bad = await app.inject({ method: "GET", url: "/whoami", headers: { authorization: `Bearer ${body.id_token}` } });
  assert.equal(bad.body, "invalid");
  assert.equal((await app.inject({ method: "GET", url: "/whoami" })).body, "anonymous");
});

test("the demo EHR launches the app, and the launch skips sign-in", async () => {
  const app = makeApp();
  const unknownApp = await app.inject({ method: "GET", url: "/smart/ehr", query: { clinic: "clinic-a", app: "https://evil.example/smart/launch" } });
  assert.equal(unknownApp.statusCode, 400);

  const ehr = await app.inject({ method: "GET", url: "/smart/ehr", query: { clinic: "clinic-a", app: "https://app.example/smart/launch" } });
  assert.equal(ehr.statusCode, 200);
  const href = /id="ehr-launch" href="([^"]+)"/.exec(ehr.body)![1].replaceAll("&amp;", "&");
  const launchUrl = new URL(href);
  assert.equal(launchUrl.searchParams.get("iss"), "https://fhir.example/fhir");

  const res = await app.inject({ method: "GET", url: "/smart/authorize", query: { ...authorize, launch: launchUrl.searchParams.get("launch")! } });
  assert.equal(res.statusCode, 303);
  assert.ok(new URL(res.headers.location as string).searchParams.get("code"));

  const forged = await app.inject({ method: "GET", url: "/smart/authorize", query: { ...authorize, launch: "abc.def.ghi" } });
  assert.equal(forged.statusCode, 400);
});

test("discovery points at this server's endpoints", async () => {
  const app = makeApp();
  const res = await app.inject({ method: "GET", url: "/fhir/.well-known/smart-configuration" });
  const conf = res.json();
  assert.equal(conf.authorization_endpoint, "https://fhir.example/smart/authorize");
  assert.equal(conf.token_endpoint, "https://fhir.example/smart/token");
  assert.deepEqual(conf.code_challenge_methods_supported, ["S256"]);
  const jwks = (await app.inject({ method: "GET", url: "/smart/jwks.json" })).json();
  assert.equal(jwks.keys[0].kty, "RSA");
  assert.equal(jwks.keys[0].d, undefined);
});
