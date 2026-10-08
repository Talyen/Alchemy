import { defineConfig } from "oxlint";
import config from "../oxlint.config.ts";

// Advisory complexity warnings do not change the normal every-push policy.
export default defineConfig({
  ...config,
  overrides: [
    ...config.overrides,
    {
      files: ["src/**/*.{ts,tsx}"],
      rules: {
        complexity: ["warn", 11],
        "max-lines-per-function": ["warn", { max: 50, skipComments: true, skipBlankLines: true }],
      },
    },
  ],
});
