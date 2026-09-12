import { describe, expect, it } from "vitest";
import { PRETTIER_GLOBS, filterPrettierPaths } from "../../scripts/prettier-paths.mjs";

describe("prettier-paths", () => {
  it("exports the shared format globs", () => {
    expect(PRETTIER_GLOBS).toEqual(
      expect.arrayContaining(["**/*.{ts,tsx,css,mjs,cjs,js,json,md,yml,yaml}", ".prettierrc"]),
    );
  });

  it("filters staged paths to Prettier-relevant files", () => {
    expect(
      filterPrettierPaths([
        "docs/ARCHITECTURE.md",
        "eslint.config.js",
        "src/App.tsx",
        "package-lock.json",
        "Raw Assets/foo.png",
        ".github/workflows/ci.yml",
        ".agents/skills/verifier/SKILL.md",
        "performance/catalog.json",
        "stryker.config.mjs",
      ]),
    ).toEqual([
      "docs/ARCHITECTURE.md",
      "eslint.config.js",
      "src/App.tsx",
      "package-lock.json",
      ".github/workflows/ci.yml",
      ".agents/skills/verifier/SKILL.md",
      "performance/catalog.json",
      "stryker.config.mjs",
    ]);
  });
});
