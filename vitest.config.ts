import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "lib/access-policy.ts",
        "lib/registration.ts",
        "lib/job-classification.ts",
        "lib/job-signals/{extractor,persist}.ts",
        "lib/scrapers/shared.ts",
        "lib/concurrency.ts",
        "lib/sync-sources.ts",
        "lib/sync-progress.ts",
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
