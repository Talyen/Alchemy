import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

const excludedTestPaths = ["tests/balance/**", "tests/playthrough/**"];
const domLibPrefixes = [
  "tests/lib/animation/",
  "tests/lib/crash-reporting",
  "tests/lib/image-preload",
  "tests/lib/platform",
];
const domTypeScriptPatterns = [
  "tests/**/*.dom.test.ts",
  "tests/**/use-*.test.ts",
  "tests/**/*-hook.test.ts",
  ...domLibPrefixes.map((prefix) => `${prefix}*.test.ts`),
  "tests/lib/animation/**/*.test.ts",
  "tests/app/escape-stack.test.ts",
  "tests/features/alchemy/run-loop/battle/battle-card-play.test.ts",
  "tests/features/alchemy/run-loop/battle/battle-presentation-store.test.ts",
  "tests/features/alchemy/run-loop/battle/controller-utils.test.ts",
  "tests/features/alchemy/run-loop/battle/hand-slot-reflow.test.ts",
  "tests/features/alchemy/run-loop/battle/presentation-gate.test.ts",
  "tests/features/alchemy/run-loop/run/labyrinth-destination-modifiers.test.ts",
  "tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts",
  "tests/features/alchemy/shared/storage/storage-io.test.ts",
  "tests/features/alchemy/shared/storage/storage-write.test.ts",
  "tests/features/alchemy/shared/stores/device-display-store.test.ts",
  "tests/features/alchemy/shared/stores/error-log-store.test.ts",
  "tests/features/alchemy/shared/stores/profile-settings-stores.test.ts",
  "tests/features/alchemy/shared/stores/reset.test.ts",
  "tests/features/alchemy/shared/stores/run-domain-session.test.ts",
  "tests/features/alchemy/shared/ui/ui-hooks.test.ts",
  "tests/features/alchemy/shared/utils/dev-mode.test.ts",
];
const domTypeScriptTests = domTypeScriptPatterns;

function testEnvironmentForPath(filePath: string): "dom" | "node" {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.endsWith(".test.tsx")) return "dom";
  if (normalized.endsWith(".dom.test.ts")) return "dom";
  if (normalized.includes("/use-") || normalized.endsWith("-hook.test.ts")) return "dom";
  if (domLibPrefixes.some((prefix) => normalized.startsWith(prefix))) return "dom";
  if (
    domTypeScriptPatterns.some(
      (pattern) => !pattern.includes("*") && normalized.endsWith(pattern.replace(/^tests\//, "")),
    )
  ) {
    return "dom";
  }
  return "node";
}

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
    projects: [
      {
        extends: true,
        test: {
          ...sharedProjectConfig,
          name: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [...excludedTestPaths, ...domTypeScriptTests],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          ...sharedProjectConfig,
          name: "dom",
          include: ["tests/**/*.test.tsx", ...domTypeScriptTests],
          exclude: excludedTestPaths,
          environment: "jsdom",
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

export { domTypeScriptTests, excludedTestPaths, testEnvironmentForPath };
