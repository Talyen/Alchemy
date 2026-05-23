import { describe, expect, it } from "vitest";
import { xpForNextPoint, xpThresholdForPoints, computeTalentPoints, xpToNextPoint, addTalentXP, getTalentKeywordProgress } from "@/lib/talents";

describe("xpForNextPoint", () => {
  it("returns 10 XP for point 0→1", () => expect(xpForNextPoint(0)).toBe(10));
  it("returns 20 XP for point 1→2", () => expect(xpForNextPoint(1)).toBe(20));
  it("returns 50 XP for point 4→5", () => expect(xpForNextPoint(4)).toBe(50));
});

describe("xpThresholdForPoints", () => {
  it("returns 0 for 0 points", () => expect(xpThresholdForPoints(0)).toBe(0));
  it("returns 10 for 1 point", () => expect(xpThresholdForPoints(1)).toBe(10));
  it("returns 30 for 2 points", () => expect(xpThresholdForPoints(2)).toBe(30));
  it("returns 60 for 3 points", () => expect(xpThresholdForPoints(3)).toBe(60));
});

describe("computeTalentPoints", () => {
  it("returns 0 for 0 XP", () => expect(computeTalentPoints(0)).toBe(0));
  it("returns 0 for XP below 10", () => expect(computeTalentPoints(9)).toBe(0));
  it("returns 1 for exactly 10 XP", () => expect(computeTalentPoints(10)).toBe(1));
  it("returns 2 for 30 XP", () => expect(computeTalentPoints(30)).toBe(2));
  it("returns 3 for 60 XP", () => expect(computeTalentPoints(60)).toBe(3));
  it("returns 4 for 100 XP", () => expect(computeTalentPoints(100)).toBe(4));
  it("does not go negative", () => expect(computeTalentPoints(-5)).toBe(0));
});

describe("xpToNextPoint", () => {
  it("returns 10 remaining from 0 XP", () => expect(xpToNextPoint(0)).toBe(10));
  it("returns 5 remaining from 5 XP", () => expect(xpToNextPoint(5)).toBe(5));
  it("returns 20 remaining from exactly 10 XP (next threshold is 30)", () => expect(xpToNextPoint(10)).toBe(20));
  it("returns 19 remaining from 11 XP (toward threshold of 30)", () => expect(xpToNextPoint(11)).toBe(19));
});

describe("addTalentXP", () => {
  it("adds XP to a new keyword", () => {
    const result = addTalentXP({}, ["physical"]);
    expect(result.physical).toBe(1);
  });

  it("adds XP to an existing keyword", () => {
    const result = addTalentXP({ physical: 3 }, ["physical"]);
    expect(result.physical).toBe(4);
  });

  it("adds XP to multiple keywords at once", () => {
    const result = addTalentXP({}, ["physical", "burn"]);
    expect(result.physical).toBe(1);
    expect(result.burn).toBe(1);
  });

  it("returns a new object without mutating the input", () => {
    const input = { physical: 1 };
    const result = addTalentXP(input, ["physical"]);
    expect(input).toEqual({ physical: 1 });
    expect(result.physical).toBe(2);
    expect(result).not.toBe(input);
  });
});

describe("getTalentKeywordProgress", () => {
  it("returns zero progress for 0 XP and 0 unlocked", () => {
    const result = getTalentKeywordProgress(0, 0);
    expect(result.totalXP).toBe(0);
    expect(result.points).toBe(0);
    expect(result.spentPoints).toBe(0);
    expect(result.unspentPoints).toBe(0);
    expect(result.hasUnspent).toBe(false);
    expect(result.progressPercent).toBe(0);
  });

  it("reports 0 points below XP threshold", () => {
    const result = getTalentKeywordProgress(9, 0);
    expect(result.points).toBe(0);
    expect(result.xpForNext).toBe(10);
    expect(result.xpRemaining).toBe(1);
    expect(result.progressPercent).toBe(90);
  });

  it("reports 1 point at exactly 10 XP", () => {
    const result = getTalentKeywordProgress(10, 0);
    expect(result.points).toBe(1);
    expect(result.xpForNext).toBe(20);
    expect(result.xpRemaining).toBe(20);
    expect(result.progressPercent).toBe(0);
    expect(result.hasUnspent).toBe(true);
  });

  it("computes progress percentage correctly", () => {
    const result = getTalentKeywordProgress(15, 0);
    expect(result.points).toBe(1);
    expect(result.xpForNext).toBe(20);
    expect(result.xpRemaining).toBe(15);
    expect(result.progressPercent).toBe(25);
  });

  it("distinguishes spent vs unspent points", () => {
    const result = getTalentKeywordProgress(30, 1);
    expect(result.points).toBe(2);
    expect(result.spentPoints).toBe(1);
    expect(result.unspentPoints).toBe(1);
    expect(result.hasUnspent).toBe(true);
  });

  it("reports hasUnspent false when all points are spent", () => {
    const result = getTalentKeywordProgress(30, 2);
    expect(result.points).toBe(2);
    expect(result.spentPoints).toBe(2);
    expect(result.unspentPoints).toBe(0);
    expect(result.hasUnspent).toBe(false);
  });

  it("handles high XP values", () => {
    const result = getTalentKeywordProgress(100, 3);
    expect(result.points).toBe(4);
    expect(result.xpForNext).toBe(50);
    expect(result.spentPoints).toBe(3);
    expect(result.unspentPoints).toBe(1);
  });

  it("clamps progress percent at 100", () => {
    const result = getTalentKeywordProgress(0, 0);
    expect(result.progressPercent).toBe(0);
  });

  it("handles more spent than available points", () => {
    const result = getTalentKeywordProgress(10, 5);
    expect(result.points).toBe(1);
    expect(result.spentPoints).toBe(5);
    expect(result.unspentPoints).toBe(0);
    expect(result.hasUnspent).toBe(false);
  });

  it("returns correct structure", () => {
    const result = getTalentKeywordProgress(0, 0);
    expect(result).toHaveProperty("totalXP");
    expect(result).toHaveProperty("points");
    expect(result).toHaveProperty("xpForNext");
    expect(result).toHaveProperty("xpRemaining");
    expect(result).toHaveProperty("progressPercent");
    expect(result).toHaveProperty("spentPoints");
    expect(result).toHaveProperty("unspentPoints");
    expect(result).toHaveProperty("hasUnspent");
  });
});
