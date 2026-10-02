import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_SUITES } from "./scripts/lib/verification/test-commands.mjs";
import { VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

export default defineConfig({
  resolve: { alias: { [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)) } },
  test: {
    include: [...TEST_SUITES.local],
    environment: "node",
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
  },
});
