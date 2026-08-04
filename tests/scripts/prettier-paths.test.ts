import { describe, expect, it } from "vitest";
import { PRETTIER_GLOBS, filterPrettierPaths } from "../../scripts/prettier-paths.mjs";

describe("prettier-paths", () => {
  it("exports the shared format globs", () => {
    expect(PRETTIER_GLOBS).toEqual(
      expect.arrayContaining([
        "*.{js,json,md,ts,yml,yaml}",
        ".prettierrc",
        "{src,tests,scripts,desktop,docs,performance}/**/*.{ts,tsx,css,mjs,cjs,md}",
      ]),
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
      ]),
    ).toEqual(["docs/ARCHITECTURE.md", "eslint.config.js", "src/App.tsx", "package-lock.json"]);
  });
});
