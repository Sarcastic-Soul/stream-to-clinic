import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
import { ACK_ACTION_IDS, acknowledgeAlert, evaluateSite, getAlert, listAlerts, scheduleEvaluation, type AckAction } from "./alerts.js";
import { loadSiteBundle } from "./bundle.js";
import { config } from "./config.js";
import { FhirError, fhir } from "./fhir.js";
import { checkValue, resolveObservedAt, toObservationSummary, toOahObservation } from "./mapping.js";
import { indicatorList, isCitizenIndicator, OAH_PROFILES, PRESENCE_VALUES, type Presence } from "./oah.js";
import { createWithPhoto, loadPhoto, parsePhoto } from "./photos.js";
import { recordProvenance } from "./provenance.js";
import { RecentIds } from "./recent.js";
import { highestLevel } from "./rules.js";
import { seed } from "./seed.js";
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
    return { status: "ok", fhir: capabilities.fhirVersion };
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
    return alert ?? reply.code(404).send({ error: `Unknown alert ${req.params.id}` });
  },
);

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

await app.listen({ host: "0.0.0.0", port: config.port });

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
