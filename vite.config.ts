import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

import tailwind from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";
import { resolveDevPort } from "./scripts/lib/dev-port.mjs";
import { CHUNK_SIZE_WARNING_KB } from "./scripts/lib/verification/bundle-budget.mjs";
import { VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";
import { rolldownCodeSplittingGroups } from "./scripts/lib/vite-chunks.mjs";
import { resolveSentryRelease, resolveSourcemapMode } from "./scripts/lib/release/sentry-release.mjs";
import { validateDesktopBuildConfig } from "./scripts/lib/release/desktop-build-config.mjs";
import { TRANSIENT_ARTIFACT_DIRS } from "./scripts/lib/clean-dev-artifacts.mjs";
import { resolveEdition, editionPolicy } from "./game-edition.mjs";

// Single port contract shared with scripts/lib/dev-port.mjs consumers (polling/stop/cleanup).
const devPort = resolveDevPort(process.env);

export default defineConfig(({ mode, command }) => {
  const edition = resolveEdition(process.env.ALCHEMY_EDITION);
  const policy = editionPolicy(edition);
  const desktopConfig = mode === "desktop" && command === "build" ? validateDesktopBuildConfig() : undefined;
  const sentryEnabled =
    process.env.CI_RELEASE === "true" && desktopConfig?.sentryUploadEnabled && Boolean(desktopConfig.sentryDsn);

  return {
    define: { __ALCHEMY_EDITION__: JSON.stringify(edition) },
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
      {
        name: "alchemy-build",
        configResolved(config) {
          if (!desktopConfig || process.env.CI_RELEASE !== "true") return;
          // CLI options override build defaults. Validate the final settings
          // before uploads or writes can leave packaging with a stale renderer.
          const rendererDirectory = fileURLToPath(new URL(policy.rendererDirectory, import.meta.url));
          if (resolve(config.root, config.build.outDir) !== rendererDirectory) {
            throw new Error(`Desktop releases must use the selected renderer directory: ${policy.rendererDirectory}`);
          }
          if (config.build.sourcemap === "inline") {
            throw new Error("Desktop releases cannot embed inline source maps in packaged JavaScript.");
          }
          if (sentryEnabled && config.build.sourcemap !== "hidden") {
            throw new Error("Production crash reporting requires hidden source maps; remove the source-map override.");
          }
        },
        generateBundle() {
          this.emitFile({ type: "asset", fileName: "edition.json", source: JSON.stringify({ edition }) });
        },
      } satisfies Plugin,
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
            filesToDeleteAfterUpload: [`${policy.rendererDirectory}/**/*.map`],
          },
          telemetry: false,
        }),
    ].filter(Boolean),
    build: {
      outDir: policy.rendererDirectory,
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
