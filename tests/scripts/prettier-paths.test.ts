import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRETTIER_NEVER_FORMAT_RE, filterPrettierPaths } from "../../scripts/lib/verification/prettier-paths.mjs";

describe("prettier-paths", () => {
  it("filters staged paths to Prettier-relevant files", () => {
    expect(
      filterPrettierPaths([
        "Docs/ARCHITECTURE.md",
        "oxlint.config.ts",
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
      "oxlint.config.ts",
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
        "src/lib/game-data/gear-art.generated.ts",
        "src/App.tsx",
      ]),
    ).toEqual(["src/App.tsx"]);
  });

  it("keeps the staged-path skip subset in sync with .prettierignore", () => {
    const ignore = readFileSync(join(process.cwd(), ".prettierignore"), "utf8");
    for (const entry of ["package-lock.json", "CHANGELOG.md", "assets.generated.ts", "gear-art.generated.ts"]) {
      expect(ignore).toContain(entry);
    }
    // The regex is the staged-path subset, not a full mirror: build outputs
    // stay in .prettierignore only.
    expect(PRETTIER_NEVER_FORMAT_RE.test("package-lock.json")).toBe(true);
    expect(PRETTIER_NEVER_FORMAT_RE.test("src/App.tsx")).toBe(false);
  });
});
