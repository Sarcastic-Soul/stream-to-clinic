// Builds and serves the service worker (/serwist/sw.js) from app/sw.ts at build time.
import { createSerwistRoute } from "@serwist/turbopack";

// Changes on every deploy, so the offline page is refreshed with the rest of the precache.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  // The report form is precached so it opens offline even before it was first visited.
  additionalPrecacheEntries: [
    { url: "/~offline", revision },
    { url: "/report", revision },
  ],
  useNativeEsbuild: true,
});
