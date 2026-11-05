import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one dedicated test database; running files
    // sequentially keeps row-level assertions deterministic.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
    teardownTimeout: 60_000,
  },
});
