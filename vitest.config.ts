import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-aliases.mjs
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

const excludedTestPaths = ["tests/performance/**", "tests/balance/**"];
const domTestPrefixes = ["tests/app/", "tests/features/"];
const domTypeScriptTestFiles = [
  "tests/lib/animation/background-particles.test.ts",
  "tests/lib/animation/combatant-status-effect-loop.test.ts",
  "tests/lib/animation/keyword-plasma.test.ts",
  "tests/lib/animation/particle-loop.test.ts",
  "tests/lib/audio-host.test.ts",
  "tests/lib/audio-music.test.ts",
  "tests/lib/audio-preload.test.ts",
  "tests/lib/audio-sfx.test.ts",
  "tests/lib/audio-sfx-playback.test.ts",
  "tests/lib/audio-volume.test.ts",
  "tests/lib/battle/block-decay.test.ts",
  "tests/lib/battle/enemy-turn.test.ts",
  "tests/lib/crash-reporting.test.ts",
  "tests/lib/image-preload.test.ts",
  "tests/lib/platform-storage.test.ts",
  "tests/lib/platform.test.ts",
  "tests/lib/validation/barrel-side-effects.test.ts",
];
const domTypeScriptTests = [...domTestPrefixes.map((prefix) => `${prefix}**/*.test.ts`), ...domTypeScriptTestFiles];

function testEnvironmentForPath(filePath: string): "dom" | "node" {
  if (filePath.endsWith(".test.tsx")) return "dom";
  if (domTestPrefixes.some((prefix) => filePath.startsWith(prefix))) return "dom";
  return domTypeScriptTestFiles.includes(filePath) ? "dom" : "node";
}

const sharedProjectConfig = {
  restoreMocks: true,
  testTimeout: 5_000,
  slowTestThreshold: 2_000,
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
        lines: 75,
        functions: 65,
        branches: 65,
        statements: 75,
      },
    },
  },
});

export { domTypeScriptTests, excludedTestPaths, testEnvironmentForPath };
