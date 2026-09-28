// Web push for clinic devices. A clinic turns notifications on in the app; the browser's push
// subscription is kept here, keyed by clinic, and every alert sent to that clinic is pushed to it,
// so an installed clinic app hears about a warning even when it is closed.
//
// Subscriptions are device addresses, not health data, so they live in a small JSON file on the
// API's volume rather than on the public FHIR server (where anyone could read them).
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import webpush from "web-push";
import type { FastifyBaseLogger } from "fastify";
import { config } from "./config.js";
import { alertEvents, type RaisedAlert } from "./events.js";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface StoredSubscription extends PushSubscriptionInput {
  clinicId: string;
  createdAt: string;
}

const MAX_SUBSCRIPTIONS = 500;

// Only the browser vendors' push services, so a subscription cannot point the server at an
// arbitrary host (the server POSTs to the endpoint).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export const pushEnabled = () => Boolean(config.vapidPublicKey && config.vapidPrivateKey);

/** Returns an error message, or undefined when the subscription looks like a real browser one. */
export function checkSubscription(sub: PushSubscriptionInput): string | undefined {
  let url: URL;
  try {
    url = new URL(sub.endpoint);
  } catch {
    return "Subscription endpoint is not a URL";
  }
  if (url.protocol !== "https:") return "Subscription endpoint must use https";
  if (!PUSH_HOSTS.some((host) => host.test(url.hostname))) return "Subscription endpoint is not a known browser push service";
  return undefined;
}

const file = () => join(config.dataDir, "push-subscriptions.json");
let cache: StoredSubscription[] | undefined;
let writing: Promise<unknown> = Promise.resolve();

async function load(): Promise<StoredSubscription[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(file(), "utf8")) as StoredSubscription[];
  } catch {
    cache = [];
  }
  return cache;
}

// Writes are serialised and atomic (temp file, then rename), so a crash cannot leave half a file.
function save(subs: StoredSubscription[]) {
  cache = subs;
  writing = writing
    .catch(() => undefined)
    .then(async () => {
      await mkdir(dirname(file()), { recursive: true });
      await writeFile(`${file()}.tmp`, JSON.stringify(subs, null, 2));
      await rename(`${file()}.tmp`, file());
    });
  return writing;
}

export async function addSubscription(clinicId: string, sub: PushSubscriptionInput): Promise<void> {
  const others = (await load()).filter((s) => s.endpoint !== sub.endpoint);
  // Oldest go first when the list is full.
  const kept = others.slice(Math.max(0, others.length - MAX_SUBSCRIPTIONS + 1));
  await save([...kept, { clinicId, endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString() }]);
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  const subs = await load();
  const kept = subs.filter((s) => s.endpoint !== endpoint);
  if (kept.length === subs.length) return false;
  await save(kept);
  return true;
}

export async function findSubscription(endpoint: string) {
  return (await load()).find((s) => s.endpoint === endpoint);
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path in the web app to open when the notification is tapped. */
  url: string;
  tag: string;
}

export function alertMessage({ alert }: RaisedAlert, clinicId: string): PushMessage {
  return {
    title: `${alert.title} · ${alert.level} risk`,
    body: `${alert.siteName}. ${alert.watchFor ? `Watch for: ${alert.watchFor}` : alert.reasons[0] ?? ""}`.trim(),
    url: `/alerts/${encodeURIComponent(alert.id)}?clinic=${encodeURIComponent(clinicId)}`,
    tag: `alert-${alert.id}`,
  };
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  configured = true;
}

/** Sends one message; a subscription the push service says is gone is forgotten. */
export async function sendPush(sub: StoredSubscription, message: PushMessage, log: FastifyBaseLogger): Promise<boolean> {
  configure();
  try {
    await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 6 * 3600, urgency: "high", timeout: 10_000 });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await removeSubscription(sub.endpoint);
    else log.warn({ status, err: String(err) }, "push delivery failed");
    return false;
  }
}

export async function pushToClinics(raised: RaisedAlert, log: FastifyBaseLogger): Promise<number> {
  if (!pushEnabled() || !raised.clinicIds.length) return 0;
  const targets = (await load()).filter((s) => raised.clinicIds.includes(s.clinicId));
  const sent = await Promise.all(targets.map((sub) => sendPush(sub, alertMessage(raised, sub.clinicId), log)));
  return sent.filter(Boolean).length;
}

export function startPush(log: FastifyBaseLogger) {
  if (!pushEnabled()) {
    log.info("web push is off (no VAPID keys)");
    return;
  }
  alertEvents.on("raised", (raised) => {
    pushToClinics(raised, log).then(
      (count) => count && log.info({ alert: raised.alert.id, count }, "alert pushed to clinic devices"),
      (err) => log.error(err, "push fan-out failed"),
    );
  });
}
