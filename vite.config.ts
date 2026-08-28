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
// @ts-ignore no types for vite-aliases.mjs
import { SSR_OPTIMIZE_INCLUDE, VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

// Single port contract shared with scripts/lib/dev-port.mjs consumers (polling/stop/cleanup).
const devPort = resolveDevPort(process.env);
const sentryRelease = process.env.SENTRY_RELEASE?.trim() || `alchemy@${process.env.npm_package_version ?? "0.0.0"}`;

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
    plugins: [
      tailwind(),
      react(),
      !process.env.VITEST &&
        babel({
          include: /\.[jt]sx$/,
          presets: [reactCompilerPreset()],
        }),
      command === "serve" &&
        // Checker is opt-in (`ALCHEMY_ENABLE_CHECKER=1`) so `npm run dev` stays snappy.
        // E2E and CI use separate `typecheck` gates; the Playwright webServer also sets
        // `ALCHEMY_SKIP_CHECKER=1` as a hard off. See docs/REFERENCE.md § Environment.
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
            name: sentryRelease,
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ["./dist/**/*.map"],
          },
          telemetry: false,
        }),
    ].filter(Boolean),
    optimizeDeps: {
      include: [...SSR_OPTIMIZE_INCLUDE],
    },
    build: {
      target: "esnext",
      assetsInlineLimit: 4096,
      // Hidden sourcemaps for any desktop build aid local repro; Sentry upload remains gated on `sentryEnabled`.
      // `ALCHEMY_SKIP_SOURCEMAP=1` opts out for fast local iterate when maps are not needed.
      sourcemap: process.env.ALCHEMY_SKIP_SOURCEMAP === "1" ? false : mode === "desktop" ? "hidden" : false,
      // App domains are still statically imported (no React.lazy — see ARCHITECTURE
      // § Boot), so this splitting never changes load semantics; it only gives the
      // browser stable, independently-cached chunks for code that churns at different
      // rates (vendor vs card data vs battle engine) and shrinks any single parse unit.
      rolldownOptions: {
        output: {
          // Keep gameplay screens eagerly loaded while letting the browser cache and parse
          // stable vendor libraries separately from frequently changed app code.
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 40,
              },
              {
                name: "motion-vendor",
                test: /[\\/]node_modules[\\/](motion|framer-motion)[\\/]/,
                priority: 30,
              },
              {
                name: "vendor",
                test: /[\\/]node_modules[\\/]/,
                priority: 10,
              },
              {
                name: "game-data",
                test: /[\\/]src[\\/]lib[\\/]game-data[\\/]/,
                priority: 9,
              },
              {
                name: "battle-engine",
                test: /[\\/]src[\\/]lib[\\/]battle[\\/]/,
                priority: 8,
              },
              {
                name: "validation",
                test: /[\\/]src[\\/]lib[\\/]validation[\\/]/,
                priority: 7,
              },
            ],
          },
        },
      },
      // No React.lazy — entry is intentionally eager. Keep warning limit in sync
      // with scripts/check-bundle-budget.mjs BUDGETS.indexMaxBytes (600 kB).
      chunkSizeWarningLimit: 600,
    },
    resolve: {
      alias: {
        [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)),
      },
    },
    // Vitest config is owned by vitest.config.ts — do not duplicate `test` here.
  };
});
