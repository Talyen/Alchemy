import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("reward selection RNG guard", () => {
  it("selectRewardCards requires a seeded RNG and does not fallback to Math.random", () => {
    const file = readFileSync(resolve("src/lib/game-data/reward-selection.ts"), "utf8");
    expect(file).not.toContain("?? Math.random");
    expect(file).not.toContain("|| Math.random");
    expect(file).toContain("rng: () => number");
    expect(file).not.toMatch(/rng\?:/);
  });
});
