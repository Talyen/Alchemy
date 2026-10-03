import { describe, expect, it } from "vitest";
import {
  computeTalentPoints,
  computeStartingMaxHealth,
  xpToNextPoint,
  addTalentXP,
  getTalentKeywordProgress,
  normalizeUnlockedTalents,
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";

describe("talent progression", () => {
  it.each([
    [19, 0, 1],
    [20, 1, 40],
    [59, 1, 1],
    [60, 2, 60],
    [119, 2, 1],
    [120, 3, 80],
  ])("awards points only at the threshold for %i XP", (xp, points, remaining) => {
    expect(computeTalentPoints(xp)).toBe(points);
    expect(xpToNextPoint(xp)).toBe(remaining);
  });

  it("adds starting Health from points earned independently across keywords", () => {
    expect(computeStartingMaxHealth({ physical: 19, health: 60 })).toBe(MAX_PLAYER_HEALTH + 2);
    expect(computeStartingMaxHealth({})).toBe(MAX_PLAYER_HEALTH);
  });

  it("awards keyword XP without changing the previous snapshot", () => {
    const input = Object.freeze({ physical: 1 });
    expect(addTalentXP(input, ["physical", "burn"], 3)).toEqual({ physical: 4, burn: 3 });
    expect(input).toEqual({ physical: 1 });
  });

  it("shows progress within the current level and caps spendable points at remaining talents", () => {
    expect(getTalentKeywordProgress(30, 0)).toEqual({
      totalXP: 30,
      points: 1,
      displayLevel: 2,
      xpForNext: 40,
      xpRemaining: 30,
      progressPercent: 25,
      spentPoints: 0,
      unspentPoints: 1,
      hasUnspent: true,
    });
    expect(getTalentKeywordProgress(200, 3, 3)).toMatchObject({ unspentPoints: 0, hasUnspent: false });
    expect(getTalentKeywordProgress(200, 1, 2)).toMatchObject({ unspentPoints: 1, hasUnspent: true });
    expect(getTalentKeywordProgress(20, 5)).toMatchObject({ unspentPoints: 0, hasUnspent: false });
    expect(getTalentKeywordProgress(20, 0)).toMatchObject({ progressPercent: 0, xpRemaining: 40 });
  });
});

describe("talent save compatibility", () => {
  it("preserves purchased talents while dropping unknown and keyword-mismatched ids", () => {
    expect(normalizeUnlockedTalents({
      burn: ["bleed-execute", "unknown-talent"],
      bleed: ["bleed-execute"],
    })).toEqual({ bleed: ["bleed-execute"] });
  });
});

describe("run-end talent XP", () => {
  it("settles exactly the rounded recap awards into permanent XP without losing other keywords", () => {
    const run = Object.freeze({ burn: 3, physical: 5 });
    const permanent = Object.freeze({ burn: 10, health: 20 });
    expect(computeRunEndTalentXPSnapshot(run, 0.5)).toEqual({ burn: 2, physical: 3 });
    expect(mergeRunTalentXPIntoPermanent(run, permanent, 0.5)).toEqual({ burn: 12, physical: 3, health: 20 });
    expect(run).toEqual({ burn: 3, physical: 5 });
    expect(permanent).toEqual({ burn: 10, health: 20 });
  });

  it("ignores malformed entries in both the recap and permanent award", () => {
    const run = { burn: "bad", physical: 3 } as unknown as { burn: number; physical: number };
    expect(computeRunEndTalentXPSnapshot(run, 1)).toEqual({ physical: 3 });
    expect(mergeRunTalentXPIntoPermanent(run, { burn: 10 }, 1)).toEqual({ burn: 10, physical: 3 });
  });
});
