import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { AlertSummary } from "../src/alerts.js";

// config is read at import time, so the data folder has to be set first.
const dataDir = await mkdtemp(join(tmpdir(), "stc-push-"));
process.env.DATA_DIR = dataDir;
const { addSubscription, alertMessage, checkSubscription, findSubscription, removeSubscription } = await import("../src/push.js");
const { isFor, sseFrame } = await import("../src/events.js");

const keys = { p256dh: "BPk", auth: "x1" };

const alert = {
  id: "d1",
  risk: "algal-bloom",
  title: "Possible algal bloom",
  level: "high",
  siteId: "Loc-Almyros",
  siteName: "Almyros monitoring reach",
  createdAt: "2026-09-28T10:00:00.000Z",
  status: "active",
  reasons: ["Abundant filamentous algae reported."],
  narrative: [],
  watchFor: "Skin irritation and gastrointestinal symptoms after contact with the water.",
  evidence: [],
  acknowledgements: [],
  fhir: { detectedIssue: "", communications: [] },
} satisfies AlertSummary;

test("checkSubscription accepts browser push services only", () => {
  assert.equal(checkSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }), undefined);
  assert.equal(checkSubscription({ endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc", keys }), undefined);
  assert.equal(checkSubscription({ endpoint: "https://web.push.apple.com/abc", keys }), undefined);
  assert.match(checkSubscription({ endpoint: "http://fcm.googleapis.com/x", keys }) ?? "", /https/);
  assert.match(checkSubscription({ endpoint: "https://hapi:8080/fhir", keys }) ?? "", /not a known/);
  assert.match(checkSubscription({ endpoint: "https://evil.example/fcm.googleapis.com", keys }) ?? "", /not a known/);
  assert.match(checkSubscription({ endpoint: "nonsense", keys }) ?? "", /not a URL/);
});

test("subscriptions are stored per clinic, replaced by endpoint and removable", async () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/device-1";
  await addSubscription("clinic-almyros", { endpoint, keys });
  await addSubscription("clinic-benevento", { endpoint, keys });

  assert.equal((await findSubscription(endpoint))?.clinicId, "clinic-benevento");
  const onDisk = JSON.parse(await readFile(join(dataDir, "push-subscriptions.json"), "utf8"));
  assert.equal(onDisk.length, 1);

  assert.equal(await removeSubscription(endpoint), true);
  assert.equal(await removeSubscription(endpoint), false);
  assert.equal(await findSubscription(endpoint), undefined);
});

test("alertMessage opens the alert for the clinic that received it", () => {
  const message = alertMessage({ alert, clinicIds: ["clinic-almyros"] }, "clinic-almyros");
  assert.equal(message.title, "Possible algal bloom · high risk");
  assert.match(message.body, /^Almyros monitoring reach\. Watch for: Skin irritation/);
  assert.equal(message.url, "/alerts/d1?clinic=clinic-almyros");
  assert.equal(message.tag, "alert-d1");
});

test("a live stream hears only the alerts sent to its clinic", () => {
  const raised = { alert, clinicIds: ["clinic-almyros", "clinic-heraklion-west"] };
  assert.equal(isFor("clinic-almyros", raised), true);
  assert.equal(isFor("clinic-benevento", raised), false);
  assert.equal(isFor(undefined, raised), true);
  assert.equal(isFor("clinic-almyros", { alert, clinicIds: [] }), false);
  assert.equal(sseFrame("alert", { id: "d1" }), 'event: alert\ndata: {"id":"d1"}\n\n');
});
