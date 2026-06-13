// Wildwood Draft pure gauntlet rule tests.
import { describe, expect, it } from "vitest";
import {
  canOfferWildwoodRemoval,
  createWildwoodBossBag,
  drawWildwoodBoss,
  getWildwoodRecoveryHealth,
  withWildwoodModifier,
} from "@/lib/content-systems/wildwood/gauntlet";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import type { BestiaryEntry } from "@/lib/game-data";

describe("Wildwood Draft gauntlet rules", () => {
  it("creates a shuffled bag containing every boss exactly once", () => {
    const bag = createWildwoodBossBag(() => 0.5);
    expect([...bag].sort()).toEqual([...WILDWOOD_BOSS_IDS].sort());
  });

  it("refills the bag and prevents a boundary repeat", () => {
    const result = drawWildwoodBoss([], "iron-bear", () => 0);
    expect(result.bossId).not.toBe("iron-bear");
    expect(result.remainingBossIds).toHaveLength(WILDWOOD_BOSS_IDS.length - 1);
  });

  it("consumes the next boss from an existing bag", () => {
    const result = drawWildwoodBoss(["forge-golem", "iron-bear"], "frostwarden", () => 0.5);
    expect(result).toEqual({ bossId: "forge-golem", remainingBossIds: ["iron-bear"] });
  });

  it("restores 20 percent max health without exceeding maximum", () => {
    expect(getWildwoodRecoveryHealth(10, 30)).toBe(16);
    expect(getWildwoodRecoveryHealth(28, 30)).toBe(30);
  });

  it("offers removal only for decks with at least eight cards", () => {
    expect(canOfferWildwoodRemoval(7)).toBe(false);
    expect(canOfferWildwoodRemoval(8)).toBe(true);
  });

  it("appends a shared combat trait without mutating the boss", () => {
    const boss: BestiaryEntry = {
      id: "boss",
      title: "Boss",
      subtitle: "",
      descriptionLines: [],
      art: "",
      enemyType: "boss",
      traits: [{ id: "normal", title: "Normal", description: "Normal trait" }],
      attackEffects: [],
    };

    const result = withWildwoodModifier(boss, "tempered");

    expect(result).not.toBe(boss);
    expect(result.traits).toEqual([
      boss.traits[0],
      { id: "tempered", title: "Tempered", description: "Gains 1 Forge each turn" },
    ]);
    expect(boss.traits).toHaveLength(1);
  });
});
