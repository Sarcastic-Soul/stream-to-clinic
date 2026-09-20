import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const baseURL = `http://127.0.0.1:${PORT}`;

// The journey tests run against the in-browser mock (NEXT_PUBLIC_API_MOCK=1), so CI never depends
// on the deployed API being up — and a red test means the app broke, not the network.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // NEXT_PUBLIC_* values are inlined at build time, so the mock build happens here, not before.
    command: `npx next build && npx next start -p ${PORT}`,
    env: { NEXT_PUBLIC_API_MOCK: "1" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
