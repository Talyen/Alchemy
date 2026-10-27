import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { processEnemyRegeneration, processEnemyTraits } from "@/lib/battle/enemy-turn-traits";
import { IRON_HIDE_ARMOR_PER_TURN, TRAIT_DAMAGE_RULES, TRAIT_FORGE_PER_TURN } from "@/lib/game-constants";
import { collectUncoveredEnemyTraitIds } from "@/lib/content-systems/enemy-trait-coverage";
import { patchBattleState } from "../../fixtures/battle";

describe("processEnemyRegeneration", () => {
  it("heals enemy when regeneration is active and not frozen for regen", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 3,
      enemyCC: { freezeSkipTurns: 0 },
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyRegeneration(state, texts);
    expect(result.enemyHealth).toBe(23);
    expect(texts.some((t) => t.kind === "heal")).toBe(true);
  });

  it("preserves a singleton regeneration packet when both healing reductions round it", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 1,
      enemyStatuses: { poison: 1, bleed: 1 },
      talentEffects: { poisonHalvesHealing: true, bleedHalvesEnemyHealing: true },
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    expect(processEnemyRegeneration(state, texts).enemyHealth).toBe(21);
    expect(texts).toEqual([{ target: "enemy", kind: "heal", stat: "health", amount: 1 }]);
  });
});

describe("processEnemyTraits", () => {
  const forgeGolem = enemyBestiary.find((e) => e.id === "forge-golem")!;
  const ironBear = enemyBestiary.find((e) => e.id === "iron-bear")!;

  it("applies rusting-carapace forge every other turn (not room-scaled)", () => {
    const state = patchBattleState({
      currentEnemy: forgeGolem,
      turn: 2,
      roomScalingMultiplier: 2,
      enemyMitigation: { forge: 0 },
    });
    const result = processEnemyTraits(state, []);
    expect(result.enemyMitigation.forge).toBe(TRAIT_FORGE_PER_TURN);
    expect(processEnemyTraits({ ...state, turn: 1 }, []).enemyMitigation.forge).toBe(0);
    expect(state.enemyMitigation.forge).toBe(0);
  });

  it("iron-hide grows Armor every other turn without a random choice", () => {
    const state = patchBattleState({
      currentEnemy: ironBear,
      turn: 2,
      roomScalingMultiplier: 1,
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyTraits(state, texts);
    expect(result.enemyMitigation.armor).toBe(IRON_HIDE_ARMOR_PER_TURN);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: IRON_HIDE_ARMOR_PER_TURN,
    });
  });

  it("handles periodic damage in trait order on even turns and recognizes the same traits as covered", () => {
    const traits = ["crimson-pulse", "radiant-judgment"].map((id) => ({ id, title: id, description: "" }));
    const state = patchBattleState({
      currentEnemy: { traits },
      turn: 2,
      playerHealth: 30,
      appliesFightPacing: false,
    });
    const texts: Parameters<typeof processEnemyTraits>[1] = [];
    const result = processEnemyTraits(state, texts);
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.bleed).toBe(1);
    expect(
      texts.filter((event) => event.target === "player" && event.kind === "damage").map((event) => event.stat),
    ).toEqual(["bleed", "holy"]);
    expect(processEnemyTraits({ ...state, turn: 1 }, []).playerHealth).toBe(30);
    expect(collectUncoveredEnemyTraitIds([...traits.map((trait) => trait.id), "toString"])).toEqual(["toString"]);
    expect(collectUncoveredEnemyTraitIds(TRAIT_DAMAGE_RULES.map((rule) => rule.traitId))).toEqual([]);
  });
});
