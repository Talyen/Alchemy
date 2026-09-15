import { describe, expect, it } from "vitest";
import { readText } from "./helpers";

describe("vite alias sync guard", () => {
  it("vite and vitest configs share the single alias source", () => {
    for (const configPath of ["vite.config.ts", "vitest.config.ts"]) {
      const config = readText(configPath);
      expect(config, `${configPath} must import the shared alias source`).toContain("./scripts/lib/vite-aliases.mjs");
      expect(config, `${configPath} must use the shared alias path`).toContain("VITE_ALIAS_PATH");
    }
  });

  it("vitest reuses the shared SSR optimizer include", () => {
    // SSR pre-bundling is a vitest-only concern; vite.config.ts has no
    // `test` field by design (see vitest.config.ts).
    expect(readText("vitest.config.ts")).toContain("...SSR_OPTIMIZE_INCLUDE");
  });
});
