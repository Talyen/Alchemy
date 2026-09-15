import { describe, expect, it } from "vitest";
import { listSourceFiles, matchingFiles, readText } from "./helpers";

const THIS_TEST = "tests/architecture/rng-canonical-doors.test.ts";

function matchingOtherFiles(paths: string[], pattern: RegExp) {
  return matchingFiles(
    paths.filter((filePath) => filePath !== THIS_TEST),
    pattern,
  );
}

describe("rng canonical doors", () => {
  it("has no remaining @/lib/run-rng imports", () => {
    const paths = listSourceFiles(["src", "tests"]);
    expect(matchingOtherFiles(paths, /(?:from\s+|import\s*\()["'](?:@\/lib\/run-rng|(?:\.\.\/)+run-rng)["']/u)).toEqual(
      [],
    );
  });

  it("keeps battle on the @/lib/rng door", () => {
    const paths = listSourceFiles("src/lib/battle");
    expect(matchingOtherFiles(paths, /(?:from\s+|import\s*\()["'](?:\.\.\/)+rng["']/u)).toEqual([]);
  });

  it("selectRewardCards requires a seeded RNG and does not fallback to Math.random", () => {
    const file = readText("src/lib/game-data/reward-selection.ts");
    expect(file).not.toMatch(/(\?\?|\|\||=|return)\s*Math\.random/u);
    expect(file).toContain("rng: () => number");
    expect(file).not.toMatch(/rng\?:/);
  });

  it("keeps gameplay code off Math.random (persisted streams only)", () => {
    // Armory crafting/dev-spawn randomness lives in meta screens and the seed
    // itself is created in shared/stores — both outside these gameplay globs by
    // design (see ARCHITECTURE.md Run randomness). Anything here must take a
    // seeded rng instead.
    const paths = listSourceFiles([
      "src/features/alchemy/run-loop/navigation",
      "src/features/alchemy/run-loop/run",
      "src/lib/mystery",
      "src/lib/gear",
      "src/lib/corruption",
    ]);
    expect(matchingOtherFiles(paths, /Math\s*\.\s*random\s*\(/u)).toEqual([]);
  });
});
