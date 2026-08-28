import { describe, expect, it } from "vitest";
import { collectKeywordsFromBattleEffect } from "@/lib/game-data/effect-metadata";
import type { BattleCardEffect } from "@/lib/game-data";

describe("collectKeywordsFromBattleEffect", () => {
  it("returns damage type for a damage effect without lifesteal", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 5 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["physical"]);
  });

  it("includes leech for a damage effect with lifesteal", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "nature", amount: 3, lifesteal: true };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["nature", "leech"]);
  });

  it("excludes haste for player-status", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "haste", amount: 1 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual([]);
  });

  it("returns block for player-status block", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "block", amount: 5 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["block"]);
  });

  it("deduplicates keywords from chance effect branches", () => {
    const inner: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 2, lifesteal: true };
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [inner],
      failureEffects: [inner],
    };

    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["physical", "leech"]);
  });

  it("merges distinct keywords from success and failure branches", () => {
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "heal", amount: 3 }],
      failureEffects: [{ kind: "gain-gold", amount: 5 }],
    };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["health", "gold"]);
  });
});
