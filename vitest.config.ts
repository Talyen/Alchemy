import { availableParallelism } from "node:os";
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import { VITEST_MAX_WORKERS } from "./scripts/lib/verification/test-concurrency.mjs";
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

const excludedTestPaths = ["tests/balance/**", "tests/playthrough/**"];
const domTypeScriptPatterns = ["tests/**/*.dom.test.ts", "tests/**/use-*.test.ts", "tests/**/*-hook.test.ts"];
const sharedProjectConfig = {
  restoreMocks: true,
  testTimeout: 5_000,
  slowTestThreshold: 1_000,
  pool: "threads" as const,
  deps: {
    optimizer: {
      ssr: {
        include: [...SSR_OPTIMIZE_INCLUDE],
      },
    },
  },
};

// Vitest owns the test/coverage config. vite.config.ts must not duplicate the `test` field;
// `vite --help` vs `vitest --help` each read their own config file.
export default defineConfig({
  resolve: {
    alias: {
      [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)),
    },
  },
  test: {
    maxWorkers: Math.min(VITEST_MAX_WORKERS, Math.max(1, availableParallelism() - 1)),
    projects: [
      {
        extends: true,
        test: {
          ...sharedProjectConfig,
          name: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [...excludedTestPaths, ...domTypeScriptPatterns],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          ...sharedProjectConfig,
          name: "dom",
          include: ["tests/**/*.test.tsx", ...domTypeScriptPatterns],
          exclude: excludedTestPaths,
          environment: "./tests/jsdom-environment.ts",
          setupFiles: ["tests/setup-dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/alchemy/**"],
      exclude: [
        "src/**/types.ts",
        "src/**/assets.ts",
        "src/features/alchemy/shared/ui/**",
        "src/features/alchemy/meta/screens/**",
        "src/features/alchemy/run-setup/screens/**",
        "src/features/alchemy/run-loop/screens/**",
        "tests/**",
        "**/*.md",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 77,
        statements: 83,
      },
    },
  },
});
