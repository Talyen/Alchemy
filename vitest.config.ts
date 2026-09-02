import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-aliases.mjs
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

const excludedTestPaths = ["tests/balance/**"];
const domTestPrefixes = ["tests/app/", "tests/features/"];
// Keep in sync with tests/architecture/vitest-projects.test.ts — this is the
// allow-list for TypeScript tests that need jsdom (e.g. HTMLMediaElement,
// canvas, platform DOM). Prefer colocation via *.dom.test.ts for new cases.
const domLibPrefixes = [
  "tests/lib/animation/",
  "tests/lib/audio-host",
  "tests/lib/audio-music",
  "tests/lib/audio-preload",
  "tests/lib/audio-sfx",
  "tests/lib/audio-volume",
  "tests/lib/battle/block-decay",
  "tests/lib/battle/enemy-turn",
  "tests/lib/crash-reporting",
  "tests/lib/image-preload",
  "tests/lib/platform",
  "tests/lib/validation/barrel",
];
const domTypeScriptTests = [
  ...domTestPrefixes.map((prefix) => `${prefix}**/*.test.ts`),
  ...domLibPrefixes.map((prefix) => `${prefix}*.test.ts`),
  "tests/lib/animation/**/*.test.ts",
  "tests/**/*.dom.test.ts",
];

function testEnvironmentForPath(filePath: string): "dom" | "node" {
  if (filePath.endsWith(".test.tsx")) return "dom";
  if (filePath.endsWith(".dom.test.ts")) return "dom";
  if (domTestPrefixes.some((prefix) => filePath.startsWith(prefix))) return "dom";
  if (domLibPrefixes.some((prefix) => filePath.startsWith(prefix))) return "dom";
  if (filePath.startsWith("tests/lib/animation/")) return "dom";
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
      // Enforced by the nightly coverage job (nightly.yml) — keep thresholds
      // at or below the measured baseline and ratchet them upward.
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
