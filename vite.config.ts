import { fileURLToPath, URL } from "node:url";

import tailwind from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";
import { resolveDevPort } from "./scripts/lib/dev-port.mjs";
import { CHUNK_SIZE_WARNING_KB } from "./scripts/lib/verification/bundle-budget.mjs";
import { VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";
import { rolldownCodeSplittingGroups } from "./scripts/lib/vite-chunks.mjs";
import { resolveSentryRelease, resolveSourcemapMode } from "./scripts/lib/release/sentry-release.mjs";
import { TRANSIENT_ARTIFACT_DIRS } from "./scripts/lib/clean-dev-artifacts.mjs";

// Single port contract shared with scripts/lib/dev-port.mjs consumers (polling/stop/cleanup).
const devPort = resolveDevPort(process.env);

export default defineConfig(({ mode, command }) => {
  const sentryEnabled =
    mode === "desktop" &&
    process.env.CI_RELEASE === "true" &&
    !!process.env.SENTRY_AUTH_TOKEN &&
    !!process.env.SENTRY_ORG &&
    !!process.env.SENTRY_PROJECT &&
    !!process.env.SENTRY_DSN;

  return {
    base: mode === "desktop" ? "./" : "/",

    server: {
      open: mode !== "desktop",
      port: devPort,
      strictPort: true,
      watch: {
        ignored: TRANSIENT_ARTIFACT_DIRS.map((dir) => `**/${dir}/**`),
      },
    },
    preview: { open: false },
    plugins: [
      tailwind(),
      react(),
      !process.env.VITEST &&
        babel({
          include: /\.[jt]sx$/,
          presets: [reactCompilerPreset()],
        }),
      command === "serve" &&
        process.env.ALCHEMY_ENABLE_CHECKER === "1" &&
        process.env.ALCHEMY_SKIP_CHECKER !== "1" &&
        checker({
          typescript: { tsconfigPath: "./tsconfig.json" },
        }),
      process.env.ANALYZE &&
        visualizer({
          open: !process.env.CI,
          gzipSize: true,
          brotliSize: true,
          filename: "reports/bundle-analysis.html",
        }),
      sentryEnabled &&
        sentryVitePlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN!,
          org: process.env.SENTRY_ORG!,
          project: process.env.SENTRY_PROJECT!,
          release: {
            name: resolveSentryRelease(),
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ["./dist/**/*.map"],
          },
          telemetry: false,
        }),
    ].filter(Boolean),
    build: {
      target: "esnext",
      assetsInlineLimit: 4096,
      reportCompressedSize: Boolean(process.env.ANALYZE),
      sourcemap: resolveSourcemapMode(mode),
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: rolldownCodeSplittingGroups(),
          },
        },
      },
      chunkSizeWarningLimit: CHUNK_SIZE_WARNING_KB,
    },
    resolve: {
      alias: {
        [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)),
      },
    },
  };
});
