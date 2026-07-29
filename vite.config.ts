/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwind from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";

const devPort = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);
const sentryRelease = process.env.SENTRY_RELEASE?.trim() || `alchemy@${process.env.npm_package_version ?? "0.0.0"}`;

if (!Number.isInteger(devPort) || devPort <= 0) {
  throw new Error(`Invalid ALCHEMY_DEV_PORT: ${process.env.ALCHEMY_DEV_PORT}`);
}

export default defineConfig(({ mode }) => {
  const sentryEnabled =
    mode === "desktop" &&
    process.env.CI_RELEASE === "true" &&
    !!process.env.SENTRY_AUTH_TOKEN &&
    !!process.env.SENTRY_ORG &&
    !!process.env.SENTRY_PROJECT &&
    !!process.env.SENTRY_DSN;

  return {
    base: process.env.VERCEL ? "/" : mode === "desktop" ? "./" : "/",
    server: { open: mode !== "desktop", port: devPort, strictPort: true },
    plugins: [
      tailwind(),
      react(),
      babel({
        presets: [reactCompilerPreset()],
      }),
      mode === "development" &&
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep gameplay screens eagerly loaded while letting the browser cache and parse
            // stable vendor libraries separately from frequently changed app code.
            if (!id.includes("node_modules")) return undefined;
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "react-vendor";
            }
            if (id.includes("/node_modules/motion/") || id.includes("/node_modules/framer-motion/")) {
              return "motion-vendor";
            }
            if (id.includes("/node_modules/lucide-react/")) return "icons-vendor";
            if (id.includes("/node_modules/@radix-ui/")) return "radix-vendor";
            return "vendor";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
      setupFiles: ["tests/setup.ts"],
      deps: {
        optimizer: {
          ssr: {
            include: ["@/lib/game-data", "@/lib/battle", "@/lib/validation"],
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
      },
    },
  };
});
