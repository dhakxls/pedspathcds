// @ts-nocheck
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "playwright-demo.spec.ts",
  reporter: [["list"]],
  workers: 1,
  projects: [
    {
      name: "chromium-demo",
      use: {
        ...devices["Desktop Chrome"],
        video: "on",
        trace: "off",
      },
    },
  ],
});
