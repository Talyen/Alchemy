import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

const { projects: _projects, ...baseTest } = (baseConfig.test ?? {}) as Record<string, unknown>;
const baseExclude = ((baseTest as { exclude?: string[] }).exclude?.filter(
  (pattern) => pattern !== "tests/balance/**",
) ?? []) as string[];

export default defineConfig({
  ...baseConfig,
  test: {
    ...(baseTest as object),
    include: ["tests/balance/**/*.test.ts"],
    exclude: baseExclude,
    environment: "node",
  },
});
