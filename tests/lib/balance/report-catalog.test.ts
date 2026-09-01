import { describe, expect, it } from "vitest";
import {
  balanceScenarioSeed,
  BOON_GAUNTLET,
  coreScenarioSeeds,
  reportCharacterIds,
  REPORT_TIERS,
} from "@/lib/balance/report-catalog";

describe("report-catalog", () => {
  it("exposes tier and gauntlet catalog", () => {
    expect(REPORT_TIERS).toHaveLength(3);
    expect(REPORT_TIERS.map((tier) => tier.label)).toEqual(["Early", "Mid", "Late"]);
    expect(BOON_GAUNTLET.map((entry) => entry.enemyId)).toEqual(["skeleton", "goblin", "mimic", "iron-bear"]);
  });

  it("derives stable seeds from scenario identity", () => {
    const identity = ["late", "wizard", "skeleton", 23, 0] as const;
    expect(balanceScenarioSeed("core", ...identity)).toBe(balanceScenarioSeed("core", ...identity));
    expect(balanceScenarioSeed("core", ...identity)).not.toBe(balanceScenarioSeed("core", ...identity, "other"));
  });

  it("shares class decks across enemies while keeping fight randomness distinct", () => {
    const skeleton = coreScenarioSeeds({
      tier: "late",
      characterId: "wizard",
      enemyId: "skeleton",
      depth: 23,
      deckIndex: 1,
    });
    const mimic = coreScenarioSeeds({
      tier: "late",
      characterId: "wizard",
      enemyId: "mimic",
      depth: 23,
      deckIndex: 1,
    });
    expect(skeleton.deckSeed).toBe(mimic.deckSeed);
    expect(skeleton.fightSeed).not.toBe(mimic.fightSeed);
    expect(reportCharacterIds()).toEqual([...reportCharacterIds()].sort());
  });
});
