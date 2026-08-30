import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["tests/balance/**/*.test.ts"],
    exclude:
      (baseConfig.test?.exclude as string[] | undefined)?.filter((pattern) => pattern !== "tests/balance/**") ?? [],
  },
});
