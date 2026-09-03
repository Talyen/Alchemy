import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const THIS_TEST = "tests/architecture/rng-canonical-doors.test.ts";

function matchingFiles(paths: string[], pattern: RegExp) {
  return paths
    .filter((filePath) => filePath !== THIS_TEST)
    .filter((filePath) => pattern.test(readFileSync(filePath, "utf8")));
}

describe("rng canonical doors", () => {
  it("has no remaining @/lib/run-rng imports", () => {
    const paths = globSync(["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"], { cwd: ROOT });
    expect(matchingFiles(paths, /(?:from\s+|import\s*\()["'](?:@\/lib\/run-rng|(?:\.\.\/)+run-rng)["']/u)).toEqual([]);
  });

  it("keeps battle on the @/lib/rng door", () => {
    const paths = globSync("src/lib/battle/**/*.{ts,tsx}", { cwd: ROOT });
    expect(matchingFiles(paths, /(?:from\s+|import\s*\()["'](?:\.\.\/)+rng["']/u)).toEqual([]);
  });
});
