import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-aliases.mjs
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

// Vitest owns the test/coverage config. vite.config.ts must not duplicate the `test` field;
// `vite --help` vs `vitest --help` each read their own config file.
export default defineConfig({
  resolve: {
    alias: {
      [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    testTimeout: 10_000,
    deps: {
      optimizer: {
        ssr: {
          include: [...SSR_OPTIMIZE_INCLUDE],
        },
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/alchemy/**"],
      exclude: [
        "src/**/types.ts",
        "src/**/assets.ts",
        "src/features/alchemy/meta/screens/**",
        "src/features/alchemy/run-setup/screens/**",
        "src/features/alchemy/run-loop/screens/**",
        "tests/**",
        "**/*.md",
      ],
      // Enforced by the nightly coverage job (nightly.yml) — keep thresholds
      // at or below the measured baseline and ratchet them upward.
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 65,
        statements: 75,
      },
    },
  },
});
