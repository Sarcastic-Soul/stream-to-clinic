import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
import { evaluateSite, getAlert, listAlerts } from "./alerts.js";
import { config } from "./config.js";
import { FhirError, fhir } from "./fhir.js";
import { checkValue, toObservationSummary, toOahObservation } from "./mapping.js";
import { indicatorList, isCitizenIndicator, PRESENCE_VALUES, type Presence } from "./oah.js";
import { highestLevel } from "./rules.js";
import { seed } from "./seed.js";
import { latestPerIndicator, loadClinics, loadSite, loadSites, siteObservations } from "./store.js";

const ID_PATTERN = "^[A-Za-z0-9\\-.]{1,64}$";

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.corsOrigins });

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

interface ReportBody {
  siteId: string;
  indicator: string;
  value: number | Presence;
  observedAt?: string;
  reporter: string;
  note?: string;
}

app.post<{ Body: ReportBody }>(
  "/reports",
  {
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
        },
      },
    },
  },
  async (req, reply) => {
    const { indicator, observedAt = new Date().toISOString(), ...body } = req.body;
    if (!isCitizenIndicator(indicator)) return reply.code(404).send({ error: `Unknown indicator ${indicator}` });
    const invalid = checkValue(indicator, body.value);
    if (invalid) return reply.code(400).send({ error: invalid });
    if (Date.parse(observedAt) > Date.now() + 5 * 60_000) {
      return reply.code(400).send({ error: "observedAt must not be in the future" });
    }
    const site = await loadSite(body.siteId);
    if (!site) return reply.code(404).send({ error: `Unknown site ${body.siteId}` });

    const created = await fhir.create(toOahObservation({ ...body, indicator, observedAt }));
    const observation = toObservationSummary(created);

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

await app.listen({ host: "0.0.0.0", port: config.port });

// Seed in the background: HAPI can take a minute or two to come up after a deploy.
async function seedAndEvaluate() {
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const count = await seed();
      app.log.info({ resources: count }, "seed data applied");
      for (const site of await loadSites()) await evaluateSite(site, app.log);
      return;
    } catch (err) {
      app.log.warn({ attempt, err: err instanceof FhirError ? err.outcome : String(err) }, "seeding failed, retrying");
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  app.log.error("giving up on seeding");
}
if (config.seed) void seedAndEvaluate();
