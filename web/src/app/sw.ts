/// <reference lib="webworker" />
// Service worker, bundled by Serwist and served from /serwist/sw.js (see app/serwist/[path]/route.ts).
import { defaultCache } from "@serwist/turbopack/worker";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Stream-to-Clinic API reads (another origin): fresh when online, last copy offline, so the report form opens without a connection.
    {
      matcher: ({ request, url, sameOrigin }) =>
        !sameOrigin && request.method === "GET" && /^\/(health|indicators|sites|clinics|alerts)(\/|$)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "stream-to-clinic-api",
        networkTimeoutSeconds: 6,
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * DAY })],
      }),
    },
    // Report photos never change once stored.
    {
      matcher: ({ request, url, sameOrigin }) => !sameOrigin && request.method === "GET" && url.pathname.startsWith("/photos/"),
      handler: new CacheFirst({
        cacheName: "stream-to-clinic-photos",
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * DAY })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
