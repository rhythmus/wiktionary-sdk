import { defineConfig } from "vitest/config";

/** Parser wall-clock checks; run via `npm run test:perf` (not default CI). */
export default defineConfig({
  test: {
    include: ["test/bench.test.ts"],
    testTimeout: 30_000,
  },
});
