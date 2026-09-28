function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  fhirBaseUrl: required("FHIR_BASE_URL", "http://localhost:8080/fhir"),
  // Base URL of the FHIR server as the public sees it, used for links in responses.
  publicFhirUrl: required("PUBLIC_FHIR_URL", "https://oneaquahealth.duckdns.org/fhir"),
  // Base URL of this API as the public sees it, used for photo links.
  publicApiUrl: required("PUBLIC_API_URL", "https://oneaquahealth.duckdns.org"),
  // Where HAPI delivers Observation notifications (FHIR rest-hook Subscription); internal network only.
  hookUrl: required("HOOK_URL", "http://api:3000/hooks/observation"),
  // Seed demo data on startup; set SEED=false to skip.
  seed: process.env.SEED !== "false",
  // Fixed rainfall for demo recordings, e.g. {"rain24h":0,"rain7d":1.2}; reasons then say
  // "demo weather override". Unset in normal operation, where Open-Meteo is used.
  weatherOverride: process.env.WEATHER_OVERRIDE
    ? (JSON.parse(process.env.WEATHER_OVERRIDE) as { rain24h: number; rain7d: number })
    : undefined,
  // Language models on Amazon Bedrock, for the plain-language advisory and the agent. Requests are
  // signed with the host's IAM role (or local AWS credentials in development); no key is stored.
  bedrockRegion: process.env.BEDROCK_REGION || "us-east-1",
  // Model IDs to try in order, comma-separated: a model that is throttled or unavailable hands the
  // request to the next. BEDROCK_MODEL=off turns both features off.
  bedrockModels: (process.env.BEDROCK_MODEL || "zai.glm-4.7-flash,mistral.ministral-3-8b-instruct")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m && m !== "off"),
  // Model-backed requests allowed per UTC day across the whole API (agent questions plus advisory
  // drafts), so a public demo cannot run up the AWS bill. Cached answers do not count.
  llmDailyLimit: Number(process.env.LLM_DAILY_LIMIT) || 100,
  // Optional: VAPID keys for web push to clinic devices (`npx web-push generate-vapid-keys`).
  // Unset means push is off; open clinic pages still get alerts over Server-Sent Events.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:oneaquahealth@example.org",
  // Where the API keeps its own small files (push subscriptions). A Docker volume in production.
  dataDir: process.env.DATA_DIR ?? "./data",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
