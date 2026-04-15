import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "pnpm dev:e2e";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER
  ? process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true"
  : !process.env.CI;
const webServerTimeout = Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT ?? 120_000);

const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "features/steps/**/*.ts",
  outputDir: ".features-gen",
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer,
    timeout: webServerTimeout,
  },
});
