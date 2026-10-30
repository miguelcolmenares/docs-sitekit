import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// 4401 unless E2E_PORT says otherwise, for a second run on the same machine.
const PORT = Number(process.env.E2E_PORT ?? 4401);

export default defineConfig({
  testDir: join(import.meta.dirname, "specs"),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serves the site that `npm run verify:package` generated and built, the way GitHub Pages would.
  webServer: {
    command: `node e2e/serve.mjs --dist e2e/.build/repo/site/dist --base /widget/ --port ${PORT}`,
    cwd: join(import.meta.dirname, ".."),
    url: `http://127.0.0.1:${PORT}/widget/`,
    reuseExistingServer: !process.env.CI,
  },
});
