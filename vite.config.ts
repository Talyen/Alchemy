/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwind from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";
import { resolveDevPort } from "./scripts/lib/dev-port.mjs";

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
        // The Playwright webServer sets this: E2E runs own typecheck as a separate
        // gate, and an in-server checker competes with test workers for CPU.
        process.env.ALCHEMY_SKIP_CHECKER !== "1" &&
        checker({
          typescript: { tsconfigPath: "./tsconfig.json" },
        }),
      process.env.ANALYZE &&
        visualizer({
          open: true,
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
    build: {
      assetsInlineLimit: 4096,
      sourcemap: sentryEnabled ? "hidden" : false,
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
                name: "icons-vendor",
                test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
                priority: 20,
              },
              {
                name: "radix-vendor",
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
                priority: 20,
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
      // Eagerly-loaded app code intentionally stays in one entry chunk; silence the
      // default 500 kB advisory that conflicts with the no-React.lazy invariant.
      chunkSizeWarningLimit: 900,
    },
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
  };
});
