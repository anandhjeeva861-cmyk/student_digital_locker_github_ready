const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node scripts/local-server.js",
    url: "http://127.0.0.1:5178",
    env: { PORT: "5178" },
    reuseExistingServer: false
  }
});
