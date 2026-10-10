import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one dedicated test database; running files
    // sequentially keeps row-level assertions deterministic.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
    teardownTimeout: 60_000,
  },
});
