import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { FhirError, fhir } from "./fhir.js";
import { toOahObservation, type CitizenReport } from "./mapping.js";
import { CITIZEN_INDICATORS } from "./oah.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.corsOrigins });

app.get("/health", async (_req, reply) => {
  try {
    const capabilities = await fhir.capabilities();
    return { status: "ok", fhir: capabilities.fhirVersion };
  } catch {
    return reply.code(503).send({ status: "degraded", fhir: "unreachable" });
  }
});

app.post<{ Body: CitizenReport }>(
  "/reports",
  {
    schema: {
      body: {
        type: "object",
        required: ["siteId", "indicator", "observedAt", "reporter", "value"],
        additionalProperties: false,
        properties: {
          siteId: { type: "string", pattern: "^[A-Za-z0-9\\-.]{1,64}$" },
          indicator: { type: "string", enum: Object.keys(CITIZEN_INDICATORS) },
          observedAt: { type: "string", format: "date-time" },
          reporter: { type: "string", minLength: 1, maxLength: 120 },
          value: { type: ["number", "string"] },
          note: { type: "string", maxLength: 1000 },
        },
      },
    },
  },
  async (req, reply) => {
    try {
      const created = await fhir.create(toOahObservation(req.body));
      return reply.code(201).send(created);
    } catch (err) {
      if (err instanceof FhirError) return reply.code(502).send(err.outcome);
      throw err;
    }
  },
);

await app.listen({ host: "0.0.0.0", port: config.port });
