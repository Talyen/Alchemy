import { describe, expect, it } from "vitest";
import { listNonTestSourceFiles, matchingFiles, readText } from "./helpers";

// Art is eager: routes import static barrels, never dynamic-import artwork.
// `import()` in type positions (`Array<import(...)>`, `as import(...)`,
// indexed-access `[import(...)]`) is erased at compile time and exempt.
const DYNAMIC_STARTUP_ALLOWLIST = new Set(["src/main.tsx"]);

function stripTypePositionImports(source: string): string {
  return source
    .replace(/:\s*import\([^)]*\)/gu, ":")
    .replace(/<import\([^)]*\)/gu, "<>")
    .replace(/\bas\s+import\([^)]*\)/gu, "")
    .replace(/\[\s*import\(/gu, "[");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|\s)\/\/[^\n]*/gu, "$1");
}

function hasValuePositionDynamicImport(filePath: string): boolean {
  return /\bimport\s*\(/u.test(stripComments(stripTypePositionImports(readText(filePath))));
}

describe("asset loading contract", () => {
  it("has no value-position dynamic imports outside the startup allowlist", () => {
    const paths = listNonTestSourceFiles("src");
    const violations = paths.filter((filePath) => hasValuePositionDynamicImport(filePath));
    const unexpected = violations.filter(
      (filePath) => ![...DYNAMIC_STARTUP_ALLOWLIST].some((allowed) => filePath.startsWith(allowed)),
    );
    expect(unexpected.slice(0, 10), `${unexpected.length} unexpected dynamic imports`).toEqual([]);
  });

  it("references the whole art catalog only from boot preload and validation", () => {
    const allowed = new Set([
      "src/lib/game-data/assets.ts",
      "src/app/use-initial-load-ready.ts",
      "src/lib/content-validation/utils.ts",
    ]);
    const referencing = matchingFiles(listNonTestSourceFiles("src"), /allGameArt/u);
    expect(referencing.filter((filePath) => !allowed.has(filePath))).toEqual([]);
  });
});
