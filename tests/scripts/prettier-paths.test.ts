import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRETTIER_GLOBS, PRETTIER_NEVER_FORMAT_RE, filterPrettierPaths } from "../../scripts/prettier-paths.mjs";

describe("prettier-paths", () => {
  it("exports the shared format globs", () => {
    expect(PRETTIER_GLOBS).toEqual(
      expect.arrayContaining(["**/*.{ts,tsx,mts,css,mjs,cjs,js,json,md,yml,yaml}", ".prettierrc"]),
    );
  });

  it("filters staged paths to Prettier-relevant files", () => {
    expect(
      filterPrettierPaths([
        "Docs/ARCHITECTURE.md",
        "eslint.config.js",
        "src/App.tsx",
        "Raw Assets/foo.png",
        ".github/workflows/ci.yml",
        ".agents/skills/verifier/SKILL.md",
        "performance/catalog.json",
        "stryker.config.mjs",
        "scripts/agent-context.d.mts",
      ]),
    ).toEqual([
      "Docs/ARCHITECTURE.md",
      "eslint.config.js",
      "src/App.tsx",
      ".github/workflows/ci.yml",
      ".agents/skills/verifier/SKILL.md",
      "performance/catalog.json",
      "stryker.config.mjs",
      "scripts/agent-context.d.mts",
    ]);
  });

  it("skips prettier-ignored paths even when staged explicitly", () => {
    expect(
      filterPrettierPaths([
        "package-lock.json",
        "CHANGELOG.md",
        "src/lib/game-data/assets.generated.ts",
        "src/lib/game-data/gear-art.ts",
        "src/App.tsx",
      ]),
    ).toEqual(["src/App.tsx"]);
  });

  it("keeps the staged-path skip subset in sync with .prettierignore", () => {
    const ignore = readFileSync(join(process.cwd(), ".prettierignore"), "utf8");
    for (const entry of ["package-lock.json", "CHANGELOG.md", "assets.generated.ts", "gear-art.ts"]) {
      expect(ignore).toContain(entry);
    }
    // The regex is the staged-path subset, not a full mirror: build outputs
    // stay in .prettierignore only.
    expect(PRETTIER_NEVER_FORMAT_RE.test("package-lock.json")).toBe(true);
    expect(PRETTIER_NEVER_FORMAT_RE.test("src/App.tsx")).toBe(false);
  });
});
