import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
import { ACK_ACTION_IDS, acknowledgeAlert, evaluateSite, getAlert, listAlerts, scheduleEvaluation, type AckAction } from "./alerts.js";
import { loadSiteBundle } from "./bundle.js";
import { config } from "./config.js";
import { FhirError, fhir } from "./fhir.js";
import { checkValue, resolveObservedAt, toObservationSummary, toOahObservation } from "./mapping.js";
import { indicatorList, isCitizenIndicator, OAH_PROFILES, PRESENCE_VALUES, type Presence } from "./oah.js";
import { createWithPhoto, loadPhoto, parsePhoto } from "./photos.js";
import { loadJourney } from "./journey.js";
import { recordProvenance } from "./provenance.js";
import { RecentIds } from "./recent.js";
import { highestLevel } from "./rules.js";
import { adviseOnAlert, advisoryEnabled, loadAdvisory } from "./advisory.js";
import { AgentError, AgentGuard, agentEnabled, askAgent } from "./agent.js";
import { registerMcp } from "./mcp.js";
import { clampDays, loadTrends, TREND_DAYS } from "./trends.js";
import { seed } from "./seed.js";
import { alertEvents, isFor, sseFrame, type RaisedAlert } from "./events.js";
import { addSubscription, checkSubscription, findSubscription, pushEnabled, removeSubscription, sendPush, startPush } from "./push.js";
import { latestPerIndicator, loadClinics, loadSite, loadSites, siteObservations } from "./store.js";

const ID_PATTERN = "^[A-Za-z0-9\\-.]{1,64}$";

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.corsOrigins });
// HAPI's Subscription notifications arrive as FHIR JSON.
app.addContentTypeParser("application/fhir+json", { parseAs: "string" }, app.getDefaultJsonParser("error", "error"));

// Errors follow docs/API.md: { error, details? }.
app.setErrorHandler<FastifyError>((err, req, reply) => {
  if (err instanceof FhirError) {
    req.log.warn({ status: err.status, outcome: err.outcome }, "FHIR server rejected request");
    return reply.code(502).send({ error: "FHIR server rejected the request", details: err.outcome });
  }
  if (err.validation) return reply.code(400).send({ error: err.message, details: err.validation });
  req.log.error(err);
  // fetch reports network failures as "fetch failed" and timeouts as TimeoutError.
  if (err.name === "TimeoutError" || err.message === "fetch failed") {
    return reply.code(502).send({ error: "FHIR server unreachable" });
  }
  const status = err.statusCode ?? 500;
  return reply.code(status).send({ error: status < 500 ? err.message : "Internal server error" });
});
app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "Not found" }));

app.get("/health", async (_req, reply) => {
  try {
    const capabilities = await fhir.capabilities();
    return { status: "ok", fhir: capabilities.fhirVersion, advisory: advisoryEnabled(), agent: agentEnabled() };
  } catch {
    return reply.code(503).send({ status: "degraded", fhir: "unreachable" });
  }
});

app.get("/indicators", async () => indicatorList());

app.get("/sites", async () => {
  const [sites, alerts] = await Promise.all([loadSites(), listAlerts()]);
  return Promise.all(
    sites.map(async (site) => ({
      ...site,
      riskLevel: highestLevel(alerts.filter((a) => a.siteId === site.id).map((a) => a.level)),
      latest: latestPerIndicator(await siteObservations(site.id)),
    })),
  );
});

const ID_PARAMS = { params: { type: "object", properties: { id: { type: "string", pattern: ID_PATTERN } } } };

app.get<{ Params: { id: string } }>("/sites/:id", { schema: ID_PARAMS }, async (req, reply) => {
  const site = await loadSite(req.params.id);
  if (!site) return reply.code(404).send({ error: `Unknown site ${req.params.id}` });
  const [observations, alerts, clinics] = await Promise.all([
    siteObservations(site.id),
    listAlerts({ siteId: site.id }),
    loadClinics(),
  ]);
  return {
    ...site,
    riskLevel: highestLevel(alerts.map((a) => a.level)),
    latest: latestPerIndicator(observations),
    observations,
    alerts,
    clinics: clinics.filter((c) => c.siteIds.includes(site.id)),
  };
});

app.get<{ Params: { id: string } }>("/sites/:id/bundle", { schema: ID_PARAMS }, async (req, reply) => {
  const bundle = await loadSiteBundle(req.params.id);
  if (!bundle) return reply.code(404).send({ error: `Unknown site ${req.params.id}` });
  return reply
    .type("application/fhir+json; charset=utf-8")
    .header("Content-Disposition", `attachment; filename="${req.params.id}-bundle.json"`)
    .send(JSON.stringify(bundle, null, 2));
});

// Observation ids written by POST /reports in the last 2 minutes; see the Subscription hook.
const recentReports = new RecentIds(120_000);

interface ReportBody {
  siteId: string;
  indicator: string;
  value: number | Presence;
  observedAt?: string;
  reporter: string;
  note?: string;
  photo?: string;
}

app.post<{ Body: ReportBody }>(
  "/reports",
  {
    bodyLimit: 2.5 * 1024 * 1024, // room for a 1.5 MB photo as base64
    schema: {
      body: {
        type: "object",
        required: ["siteId", "indicator", "reporter", "value"],
        additionalProperties: false,
        properties: {
          siteId: { type: "string", pattern: ID_PATTERN },
          indicator: { type: "string", maxLength: 64 },
          observedAt: { type: "string", format: "date-time" },
          reporter: { type: "string", minLength: 1, maxLength: 120 },
          value: { anyOf: [{ type: "number" }, { type: "string", enum: [...PRESENCE_VALUES] }] },
          note: { type: "string", maxLength: 1000 },
          photo: { type: "string", maxLength: 2_200_000 },
        },
      },
    },
  },
  async (req, reply) => {
    const { indicator, photo: photoDataUrl, ...body } = req.body;
    if (!isCitizenIndicator(indicator)) return reply.code(404).send({ error: `Unknown indicator ${indicator}` });
    const invalid = checkValue(indicator, body.value);
    if (invalid) return reply.code(400).send({ error: invalid });
    const observedAt = resolveObservedAt(body.observedAt);
    if (!observedAt) return reply.code(400).send({ error: "observedAt must not be more than 24 hours in the future" });
    const photo = photoDataUrl === undefined ? undefined : parsePhoto(photoDataUrl);
    if (typeof photo === "string") return reply.code(400).send({ error: photo });
    const site = await loadSite(body.siteId);
    if (!site) return reply.code(404).send({ error: `Unknown site ${body.siteId}` });

    const resource = toOahObservation({ ...body, indicator, observedAt });
    const created = photo ? await createWithPhoto(resource, photo) : await fhir.create(resource);
    if (created.id) recentReports.add(created.id);
    const observation = toObservationSummary(created);

    if (created.id) {
      const targets = [`Observation/${created.id}`, ...(created.derivedFrom ?? []).flatMap((d) => d.reference ?? [])];
      // Lineage is valuable but never worth losing a citizen's report over.
      try {
        await recordProvenance(targets, body.reporter);
      } catch (err) {
        req.log.error(err, "provenance write failed");
      }
    }

    let alerts: Awaited<ReturnType<typeof evaluateSite>> = [];
    try {
      alerts = await evaluateSite(site, req.log);
    } catch (err) {
      // The report is stored; a failed evaluation must not turn it into an error for the citizen.
      req.log.error(err, "risk evaluation failed");
    }
    return reply.code(201).send({ observation, fhirUrl: `${config.publicFhirUrl}/Observation/${created.id}`, alerts });
  },
);

// Everything that happened to one citizen report, for the reporter's "what happened" page.
app.get<{ Params: { id: string } }>("/reports/:id/journey", { schema: ID_PARAMS }, async (req, reply) => {
  const journey = await loadJourney(req.params.id);
  if (!journey) return reply.code(404).send({ error: `Unknown report ${req.params.id}` });
  return journey;
});

const PHOTO_CACHE = "public, max-age=31536000, immutable";
app.get<{ Params: { id: string } }>("/photos/:id", { schema: ID_PARAMS }, async (req, reply) => {
  const photo = await loadPhoto(req.params.id);
  if (!photo) return reply.code(404).send({ error: `Unknown photo ${req.params.id}` });
  return reply
    .type(photo.contentType)
    .header("Cache-Control", PHOTO_CACHE)
    .header("X-Content-Type-Options", "nosniff")
    .send(photo.data);
});

// FHIR rest-hook target for the citizen-observations Subscription (see seed.ts). HAPI calls it over
// the internal Docker network; anything relayed by the public proxy is refused (Caddy also blocks
// /hooks, and always adds X-Forwarded-For).
const isProxied = (headers: Record<string, unknown>) => ["x-forwarded-for", "x-forwarded-host", "via"].some((h) => h in headers);
// With a payload, HAPI delivers each matching Observation as PUT <endpoint>/Observation/<id>.
app.put<{ Body: fhir4.Observation | undefined }>("/hooks/observation/Observation/:id", async (req, reply) => {
  if (isProxied(req.headers)) return reply.code(404).send({ error: "Not found" });
  const observation = req.body;
  const siteId = observation?.subject?.reference?.match(/^Location\/([A-Za-z0-9\-.]{1,64})$/)?.[1];
  // HAPI parses any response body as a FHIR resource, so answer 204 with none.
  if (observation?.resourceType !== "Observation" || !siteId || !observation.meta?.profile?.includes(OAH_PROFILES.observationIndicators)) {
    return reply.code(204).send();
  }
  // Reports written through POST /reports were evaluated there already.
  if (observation.id && recentReports.has(observation.id)) return reply.code(204).send();
  const site = await loadSite(siteId);
  if (site) {
    req.log.info({ observation: observation.id, siteId }, "subscription notification: re-evaluating site");
    // Answer at once; the evaluation runs in the background and never creates Observations, so no loop.
    scheduleEvaluation(site, req.log);
  }
  return reply.code(204).send();
});

app.get("/clinics", async () => loadClinics());

app.get<{ Querystring: { clinicId?: string; siteId?: string } }>(
  "/alerts",
  {
    schema: {
      querystring: {
        type: "object",
        properties: { clinicId: { type: "string", pattern: ID_PATTERN }, siteId: { type: "string", pattern: ID_PATTERN } },
      },
    },
  },
  async (req) => listAlerts(req.query),
);

app.get<{ Params: { id: string } }>(
  "/alerts/:id",
  { schema: ID_PARAMS },
  async (req, reply) => {
    const alert = await getAlert(req.params.id);
    if (!alert) return reply.code(404).send({ error: `Unknown alert ${req.params.id}` });
    const advisory = await loadAdvisory(alert.id).catch(() => undefined);
    return { ...alert, ...(advisory ? { advisory } : {}) };
  },
);

// Rewrites an alert the rule engine already decided as a short notice for clinic staff. The model
// is given the alert's own reasons and narrative and nothing else; it never changes the risk or
// its level. The draft is stored as a FHIR Communication sent by a Device, with a Provenance
// naming that Device as author, so machine-written text is marked as such wherever it is read.
app.post<{ Params: { id: string } }>("/alerts/:id/advisory", { schema: ID_PARAMS }, async (req, reply) => {
  const result = await adviseOnAlert(await getAlert(req.params.id));
  if ("error" in result) return reply.code(result.status).send({ error: result.error });
  return reply.code(201).send(result);
});

// A notified clinic reports back what it did. Closes the loop: the reply is a FHIR Communication
// linked to the one we sent, so the environmental side can see which warnings led to action.
app.post<{ Params: { id: string }; Body: { clinicId: string; action: AckAction; note?: string } }>(
  "/alerts/:id/acknowledge",
  {
    schema: {
      ...ID_PARAMS,
      body: {
        type: "object",
        required: ["clinicId", "action"],
        additionalProperties: false,
        properties: {
          clinicId: { type: "string", pattern: ID_PATTERN },
          action: { type: "string", enum: ACK_ACTION_IDS },
          note: { type: "string", maxLength: 500 },
        },
      },
    },
  },
  async (req, reply) => {
    const { clinicId, action, note } = req.body;
    const result = await acknowledgeAlert(req.params.id, clinicId, action, note);
    if ("error" in result) return reply.code(result.status).send({ error: result.error });
    return reply.code(201).send(result);
  },
);

// Live alerts for an open clinic page: Server-Sent Events, one "alert" event per newly raised alert
// sent to that clinic (or every alert, without clinicId). The FHIR Communication is still the record;
// this only saves the page from polling. EventSource reconnects on its own after a drop.
const MAX_STREAMS = 200;
let openStreams = 0;
app.get<{ Querystring: { clinicId?: string } }>(
  "/events",
  {
    schema: {
      querystring: { type: "object", additionalProperties: false, properties: { clinicId: { type: "string", pattern: ID_PATTERN } } },
    },
  },
  async (req, reply) => {
    if (openStreams >= MAX_STREAMS) return reply.code(503).send({ error: "Too many live connections, try again shortly" });
    const { clinicId } = req.query;
    reply.hijack();
    const res = reply.raw;
    // Hijacked replies skip Fastify's header handling, so the CORS headers set by the plugin are copied by hand.
    res.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    openStreams++;
    res.write(`retry: 5000\n\n${sseFrame("ready", { clinicId: clinicId ?? null, at: new Date().toISOString() })}`);
    const onRaised = (raised: RaisedAlert) => {
      if (isFor(clinicId, raised)) res.write(sseFrame("alert", raised.alert));
    };
    alertEvents.on("raised", onRaised);
    // A comment line every 25 s keeps proxies from closing an idle stream.
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.raw.on("close", () => {
      clearInterval(ping);
      alertEvents.off("raised", onRaised);
      openStreams--;
    });
  },
);

// Web push for installed clinic apps (see push.ts). The public key is what the browser subscribes with.
app.get("/push/key", async (_req, reply) => {
  if (!pushEnabled()) return reply.code(503).send({ error: "Web push is not configured on this server" });
  return { publicKey: config.vapidPublicKey };
});

const SUBSCRIPTION_SCHEMA = {
  type: "object",
  required: ["endpoint", "keys"],
  properties: {
    endpoint: { type: "string", maxLength: 1000 },
    keys: {
      type: "object",
      required: ["p256dh", "auth"],
      properties: { p256dh: { type: "string", maxLength: 200 }, auth: { type: "string", maxLength: 100 } },
    },
  },
} as const;

app.post<{ Body: { clinicId: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } } }>(
  "/push/subscriptions",
  {
    schema: {
      body: {
        type: "object",
        required: ["clinicId", "subscription"],
        additionalProperties: false,
        properties: { clinicId: { type: "string", pattern: ID_PATTERN }, subscription: SUBSCRIPTION_SCHEMA },
      },
    },
  },
  async (req, reply) => {
    if (!pushEnabled()) return reply.code(503).send({ error: "Web push is not configured on this server" });
    const { clinicId, subscription } = req.body;
    const invalid = checkSubscription(subscription);
    if (invalid) return reply.code(400).send({ error: invalid });
    if (!(await loadClinics()).some((c) => c.id === clinicId)) return reply.code(404).send({ error: `Unknown clinic ${clinicId}` });
    await addSubscription(clinicId, { endpoint: subscription.endpoint, keys: subscription.keys });
    return reply.code(201).send({ clinicId, endpoint: subscription.endpoint });
  },
);

const ENDPOINT_BODY = {
  body: { type: "object", required: ["endpoint"], additionalProperties: false, properties: { endpoint: { type: "string", maxLength: 1000 } } },
};

app.post<{ Body: { endpoint: string } }>("/push/unsubscribe", { schema: ENDPOINT_BODY }, async (req, reply) => {
  await removeSubscription(req.body.endpoint);
  return reply.code(204).send();
});

// Sends a test notification to one device that is already subscribed, so a clinic can check it works.
app.post<{ Body: { endpoint: string } }>("/push/test", { schema: ENDPOINT_BODY }, async (req, reply) => {
  if (!pushEnabled()) return reply.code(503).send({ error: "Web push is not configured on this server" });
  const sub = await findSubscription(req.body.endpoint);
  if (!sub) return reply.code(404).send({ error: "This device is not subscribed" });
  const sent = await sendPush(
    sub,
    { title: "Stream-to-Clinic test", body: "Notifications are on. Alerts for your clinic will appear like this.", url: `/clinic?clinic=${encodeURIComponent(sub.clinicId)}`, tag: "test" },
    req.log,
  );
  if (!sent) return reply.code(502).send({ error: "The push service did not accept the notification" });
  return { sent: true };
});

// Catchment view: several weeks of citizen reports per site and per region, for a health
// authority deciding where to look, rather than a clinic acting on one alert.
app.get<{ Querystring: { days?: number } }>(
  "/trends",
  {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: { days: { type: "integer", minimum: TREND_DAYS.min, maximum: TREND_DAYS.max } },
      },
    },
  },
  async (req) => loadTrends(clampDays(req.query.days ?? TREND_DAYS.default)),
);

// Questions about the data, answered by a model that may only call the read-only FHIR tools in
// agent-tools.ts. The answer comes back with every tool call and the public FHIR query behind it.
const agentGuard = new AgentGuard();
// Behind Caddy the client is the first X-Forwarded-For entry; the socket address is the proxy.
const clientOf = (req: { headers: Record<string, unknown>; ip: string }) =>
  String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || req.ip;

app.post<{ Body: { question: string } }>(
  "/agent/ask",
  {
    schema: {
      body: {
        type: "object",
        required: ["question"],
        additionalProperties: false,
        properties: { question: { type: "string", minLength: 3, maxLength: 500 } },
      },
    },
  },
  async (req, reply) => {
    const question = req.body.question.trim();
    const cached = agentGuard.cached(question);
    if (cached) return cached;
    if (!agentEnabled()) return reply.code(503).send({ error: "The agent model is not configured on this server" });
    const refusal = agentGuard.admit(clientOf(req));
    if (refusal) return reply.code(429).send({ error: refusal });
    try {
      const answer = await askAgent(question);
      agentGuard.remember(answer);
      req.log.info({ question, tools: answer.steps.map((s) => s.tool) }, "agent answered");
      return answer;
    } catch (err) {
      if (err instanceof AgentError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  },
);

// The same read-only tools as a remote MCP server (Streamable HTTP, stateless).
registerMcp(app);

await app.listen({ host: "0.0.0.0", port: config.port });
startPush(app.log);

// Applies the seed (its synthetic history is dated relative to today) and re-runs every site's rules,
// so alerts also close when their evidence ages out of the look-back window or the weather changes.
async function refresh() {
  const count = await seed();
  app.log.info({ resources: count }, "seed data applied");
  for (const site of await loadSites()) await evaluateSite(site, app.log);
}

const REFRESH_MS = 24 * 3_600_000;

// Seed in the background: HAPI can take a minute or two to come up after a deploy. Then refresh daily.
async function seedAndEvaluate() {
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      await refresh();
      setInterval(() => refresh().catch((err) => app.log.error(err, "daily refresh failed")), REFRESH_MS);
      return;
    } catch (err) {
      app.log.warn({ attempt, err: err instanceof FhirError ? err.outcome : String(err) }, "seeding failed, retrying");
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  app.log.error("giving up on seeding");
}
if (config.seed) void seedAndEvaluate();
