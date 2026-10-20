import { describe, expect, it } from "vitest";
import {
  canUnlockTalent,
  tryUnlockTalent,
  getAllocatableTalentChoices,
  computeTalentPoints,
  computeStartingMaxHealth,
  xpToNextPoint,
  addTalentXP,
  getTalentKeywordProgress,
  normalizeUnlockedTalents,
  computeRunEndTalentXPSnapshot,
  mergeTalentXPAwards,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";

describe("talent progression", () => {
  it.each([
    [0, 0, 10],
    [9, 0, 1],
    [10, 1, 30],
    [39, 1, 1],
    [40, 2, 60],
    [99, 2, 1],
    [100, 3, 80],
    [179, 3, 1],
    [180, 4, 100],
    [2814749934878699, 16777215, 1],
    [2814749934878700, 16777216, 335544340],
  ])("awards points only at the threshold for %i XP", (xp, points, remaining) => {
    expect(computeTalentPoints(xp)).toBe(points);
    expect(xpToNextPoint(xp)).toBe(remaining);
  });

  it("adds starting Health from points earned independently across keywords", () => {
    expect(computeStartingMaxHealth({ physical: 9, health: 40 })).toBe(MAX_PLAYER_HEALTH + 2);
    expect(computeStartingMaxHealth({})).toBe(MAX_PLAYER_HEALTH);
  });

  it("ignores tree-less keywords so saved Thorns XP cannot grant hidden Health", () => {
    expect(computeStartingMaxHealth({ thorns: 40 })).toBe(MAX_PLAYER_HEALTH);
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
      xpForNext: 30,
      xpRemaining: 10,
      progressPercent: 67,
      spentPoints: 0,
      unspentPoints: 1,
      hasUnspent: true,
    });
    expect(getTalentKeywordProgress(200, 3, 3)).toMatchObject({ unspentPoints: 0, hasUnspent: false });
    expect(getTalentKeywordProgress(200, 1, 2)).toMatchObject({ unspentPoints: 1, hasUnspent: true });
    expect(getTalentKeywordProgress(20, 5)).toMatchObject({ unspentPoints: 0, hasUnspent: false });
    expect(getTalentKeywordProgress(10, 0)).toMatchObject({ progressPercent: 0, xpRemaining: 30 });
  });
});

it("talent save compatibility preserves purchased talents while dropping unknown and keyword-mismatched ids", () => {
  expect(
    normalizeUnlockedTalents({
      burn: ["bleed-execute", "unknown-talent"],
      bleed: ["bleed-execute"],
    }),
  ).toEqual({ bleed: ["bleed-execute"] });
});

describe("run-end talent XP", () => {
  it("settles exactly the rounded recap awards into permanent XP without losing other keywords", () => {
    const run = Object.freeze({ burn: 3, physical: 5 });
    const permanent = Object.freeze({ burn: 10, health: 20 });
    const awards = Object.freeze(computeRunEndTalentXPSnapshot(run, 0.5));
    expect(awards).toEqual({ burn: 2, physical: 3 });
    expect(mergeTalentXPAwards(permanent, awards)).toEqual({ burn: 12, physical: 3, health: 20 });
    expect(run).toEqual({ burn: 3, physical: 5 });
    expect(permanent).toEqual({ burn: 10, health: 20 });
  });

  it("ignores malformed entries in both the recap and permanent award", () => {
    const run = { burn: "bad", physical: 3 } as unknown as { burn: number; physical: number };
    expect(computeRunEndTalentXPSnapshot(run, 1)).toEqual({ physical: 3 });
    expect(mergeTalentXPAwards({ burn: 10 }, computeRunEndTalentXPSnapshot(run, 1))).toEqual({ burn: 10, physical: 3 });
  });
});

it("spends earned points exactly once and rejects the next eligible Talent until more XP is earned", () => {
  const first = getAllocatableTalentChoices("physical", [])[0]!;
  expect(canUnlockTalent("physical", first.id, { physical: 9 }, {})).toEqual({
    ok: false,
    reason: "no-unspent-points",
  });
  for (const invalid of [Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(canUnlockTalent("physical", first.id, { physical: invalid }, {})).toEqual({
      ok: false,
      reason: "no-unspent-points",
    });
  }
  const result = tryUnlockTalent("physical", first.id, { physical: 10 }, {});
  if (!result.unlockedTalents) throw new Error("Expected an earned Talent point");
  expect(canUnlockTalent("physical", first.id, { physical: 10 }, result.unlockedTalents)).toEqual({
    ok: false,
    reason: "already-unlocked",
  });
  const next = getAllocatableTalentChoices("physical", result.unlockedTalents.physical!)[0]!;
  expect(canUnlockTalent("physical", next.id, { physical: 39 }, result.unlockedTalents)).toEqual({
    ok: false,
    reason: "no-unspent-points",
  });
  expect(canUnlockTalent("physical", next.id, { physical: 40 }, result.unlockedTalents)).toEqual({ ok: true });
});
