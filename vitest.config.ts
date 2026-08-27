import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

// Vitest owns the test/coverage config. vite.config.ts must not duplicate the `test` field;
// `vite --help` vs `vitest --help` each read their own config file.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    deps: {
      optimizer: {
        ssr: {
          include: [
            "@/lib/game-data",
            "@/lib/battle",
            "@/lib/validation",
            "@/lib/gear",
            "@/lib/routing",
            "@/features/alchemy/shared",
          ],
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
        "src/components/**",
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
