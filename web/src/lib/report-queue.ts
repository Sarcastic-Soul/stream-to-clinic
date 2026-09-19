// Reports made without a connection wait in IndexedDB and are sent, oldest first, when the device is back online.
// No Background Sync: the queue flushes whenever the app is open (on load and on the `online` event).

import { createStore, del, entries, set } from "idb-keyval";
import { ApiError, api } from "./api";
import type { ReportInput, ReportResult } from "./types";

export interface QueuedReport {
  id: string;
  input: ReportInput;
  siteName: string;
  indicatorDisplay: string;
  queuedAt: string;
}

export type FlushOutcome =
  | { item: QueuedReport; ok: true; result: ReportResult }
  | { item: QueuedReport; ok: false; error: string };

export const QUEUE_EVENT = "stream-to-clinic:queue";

// Created lazily: IndexedDB does not exist during server rendering.
let store: ReturnType<typeof createStore> | undefined;
const queueStore = () => (store ??= createStore("stream-to-clinic", "report-queue"));

const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));

/** True when the report could not reach the server at all (offline, DNS, timeout), so it is worth queueing. */
export const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;

export async function enqueueReport(item: Omit<QueuedReport, "id" | "queuedAt">): Promise<QueuedReport> {
  const queued = { ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  await set(queued.id, queued, queueStore());
  changed();
  return queued;
}

export async function listQueued(): Promise<QueuedReport[]> {
  try {
    const all = await entries<string, QueuedReport>(queueStore());
    return all.map(([, item]) => item).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

let flushing: Promise<FlushOutcome[]> | undefined;

/**
 * Sends queued reports in order. Stops at the first network or server error and keeps the rest for later.
 * A report the API rejects as invalid (4xx) is dropped and returned as a failure, so it cannot block the queue.
 */
export function flushQueue(): Promise<FlushOutcome[]> {
  flushing ??= (async () => {
    const outcomes: FlushOutcome[] = [];
    try {
      for (const item of await listQueued()) {
        try {
          const result = await api.createReport(item.input);
          outcomes.push({ item, ok: true, result });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) break;
          outcomes.push({ item, ok: false, error: error.message });
        }
        await del(item.id, queueStore()).catch(() => undefined);
      }
    } finally {
      flushing = undefined;
      if (outcomes.length) changed();
    }
    return outcomes;
  })();
  return flushing;
}
