import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  use: { baseURL: "http://127.0.0.1:4173/Michael-levin-videos2/" },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:4173/Michael-levin-videos2/", reuseExistingServer: false },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
