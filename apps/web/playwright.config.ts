import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: [
    {
      name: "api",
      command: "node dist/main.js",
      cwd: "../api",
      url: "http://127.0.0.1:4100/api/v1/health",
      env: {
        NODE_ENV: "production",
        PORT: "4100",
        WEB_ORIGINS: "http://127.0.0.1:3100",
      },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      name: "web",
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: {
        NODE_ENV: "production",
        API_INTERNAL_BASE_URL: "http://127.0.0.1:4100/api/v1",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100/api/v1",
      },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      name: "web-without-api",
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      // Same compiled web; only its runtime internal endpoint is unavailable.
      env: {
        NODE_ENV: "production",
        API_INTERNAL_BASE_URL: "http://127.0.0.1:4199/api/v1",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100/api/v1",
      },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
});
