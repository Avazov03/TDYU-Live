import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { resolveBaseURL } from "./e2e/helpers/env";

/**
 * Browser E2E — local/staging only.
 * Default base URL: http://localhost:3000
 * Override: TEST_BASE_URL or PLAYWRIGHT_BASE_URL (never production).
 */
const baseURL = resolveBaseURL();
const isCI = !!process.env.CI;
const externalServer = !!(process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // `*.test.ts` under e2e/ are node:test unit files (npm run test:e2e:env), not browser specs.
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Windows paths with spaces + parallel retain-on-failure traces can ENOENT on close.
  workers: isCI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    headless: process.env.HEADED === "1" ? false : true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Local retries=0 — still keep a trace when a test fails (not only on retry).
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/live/**", "**/recording/**", "**/mobile/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Read-only specs re-run on a phone viewport (Chromium engine — no extra browser download).
      name: "mobile",
      testMatch: ["**/mobile/**/*.spec.ts", "**/smoke/public.spec.ts", "**/shell/**/*.spec.ts", "**/catalog/**/*.spec.ts"],
      use: { ...devices["Pixel 7"] },
    },
    {
      // Live/recording specs share the one fixture teacher; schedule rules allow one running lesson per teacher.
      name: "live-serial",
      testMatch: ["**/live/**/*.spec.ts", "**/recording/**/*.spec.ts"],
      workers: 1,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
