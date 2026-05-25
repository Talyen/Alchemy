/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { visualizer } from "rollup-plugin-visualizer";

const devPort = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);

if (!Number.isInteger(devPort) || devPort <= 0) {
  throw new Error(`Invalid ALCHEMY_DEV_PORT: ${process.env.ALCHEMY_DEV_PORT}`);
}

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.DEV": mode === "development" ? "true" : "false",
  },
  base: process.env.VERCEL ? "/" : mode === "desktop" ? "./" : "/",
  server: { open: true, port: devPort, strictPort: true },
  plugins: [
    react(),
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
  ].filter(Boolean),
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep gameplay screens eagerly loaded while letting the browser cache and parse
          // stable vendor libraries separately from frequently changed app code.
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom")) return "react-vendor";
          if (id.includes("motion")) return "motion-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
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
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/alchemy/**"],
      exclude: ["src/**/*.tsx", "src/**/types.ts", "src/**/assets.ts", "tests/**"],
    },
  },
}));
