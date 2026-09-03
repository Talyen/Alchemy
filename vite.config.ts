import { fileURLToPath, URL } from "node:url";

import tailwind from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";
import { resolveDevPort } from "./scripts/lib/dev-port.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for bundle-budget.mjs
import { CHUNK_SIZE_WARNING_KB } from "./scripts/lib/bundle-budget.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-aliases.mjs
import { VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-chunks.mjs
import { resolveManualChunk, rolldownCodeSplittingGroups } from "./scripts/lib/vite-chunks.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for sentry-release.mjs
import { resolveSentryRelease, resolveSourcemapMode } from "./scripts/lib/sentry-release.mjs";

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

    server: { open: mode !== "desktop", port: devPort, strictPort: true },
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
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk,
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
