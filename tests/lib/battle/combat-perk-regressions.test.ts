import { describe, expect, it } from "vitest";
import { applyEnemyHealingWithCombatText } from "@/lib/battle/combat-text";
import { processEnemyDamageEffect, applyEnemyLeechHealing } from "@/lib/battle/enemy-attack-damage";
import { processEnemyRegeneration } from "@/lib/battle/enemy-turn-traits";
import { processEncounterTraitActionStart } from "@/lib/battle/encounter-trait-events";
import { processEncounterTraitHealthThreshold } from "@/lib/battle/encounter-trait-health-threshold";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { companionLibrary } from "@/lib/game-data";
import { computeLeechHeal } from "@/lib/battle/damage-rider-leech";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat perk regressions", () => {
  it.each(["poison", "bleed"] as const)("Block prevents %s buildup when a hit breaks through", (damageType) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: { blockPreventsPoison: true, blockPreventsBleed: true },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 6 }, []);
    expect(result.playerHealth).toBe(26);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses[damageType]).toBe(0);
    expect(state.playerStatuses.block).toBe(2);
    const unprotected = processEnemyDamageEffect(
      patchBattleState({ playerStatuses: { block: 2 } }),
      { kind: "damage", damageType, amount: 6 },
      [],
    );
    expect(unprotected.playerStatuses[damageType]).toBeGreaterThan(0);
  });

  it.each(["poison", "bleed", "both"] as const)("reduces all enemy healing with %s", (status) => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 100,
      enemyRegeneration: 8,
      roomScalingMultiplier: 8,
      enemyStatuses: { poison: status === "bleed" ? 0 : 1, bleed: status === "poison" ? 0 : 1 },
      talentEffects: { poisonHalvesHealing: true, bleedHalvesEnemyHealing: true },
      currentEnemy: { traits: [{ id: "overgrowth", title: "Overgrowth", description: "" }] },
    });
    const expected = status === "both" ? 22 : 24;
    expect(applyEnemyHealingWithCombatText(state, 8, []).enemyHealth).toBe(expected);
    expect(applyEnemyLeechHealing(state, 16, []).enemyHealth).toBe(expected);
    expect(processEnemyRegeneration(state, []).enemyHealth).toBe(expected);
    expect(processEncounterTraitActionStart(state, []).enemyHealth).toBe(expected);
  });

  it("Vanguard's Crest applies Forge bonuses and threshold rewards", () => {
    const state = patchBattleState({
      playerStatuses: { block: 5, forge: 2 },
      trinketEffects: { vanguardCrestForgeOnBlockAbsorb: 1 },
      talentEffects: { flatForgeGained: 1, forgeBurnThreshold: 4, forgeBurnDamage: 8 },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(result.playerHealth).toBe(state.playerHealth);
    expect(result.playerStatuses.forge).toBe(4);
    expect(result.enemyHealth).toBe(state.enemyHealth - 8);
    expect(result.enemyStatuses.burn).toBe(8);
  });

  it("Forge from Burn damage receives Forge gain bonuses", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 1 }] });
    const state = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      gearEffects: { forgeOnBurnDealt: 1 },
      talentEffects: { flatForgeGained: 1 },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("Second Wind does not suppress Divine Aegis on the same Health crossing", () => {
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 100,
      currentEnemy: {
        traits: [
          { id: "second-wind", title: "Second Wind", description: "" },
          { id: "divine-aegis", title: "Divine Aegis", description: "" },
        ],
      },
    });
    const result = processEncounterTraitHealthThreshold(60, state, []);
    expect(result.enemyHealth).toBe(60);
    expect(result.flags.secondWindTriggered).toBe(true);
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation).toMatchObject({ armor: 2, block: 4 });
    expect(processEncounterTraitHealthThreshold(60, result, [])).toBe(result);
  });

  it("Sanguine Gear increases Companion Leech", () => {
    const state = patchBattleState({
      activeCompanion: {
        ...companionLibrary.wolf,
        turnStartEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      },
      rng: () => 0.99,
      playerHealth: 10,
      playerMaxHealth: 100,
      gearEffects: { leechHealBonusPercent: 50 },
      talentEffects: { companionLeechChance: 100 },
    });
    const result = processCompanionTurnStart(state, []);
    const damage = state.enemyHealth - result.enemyHealth;
    expect(damage).toBeGreaterThan(0);
    expect(result.playerHealth - state.playerHealth).toBe(Math.round(computeLeechHeal(damage) * 1.5));
  });

  it("Sanguine Gear increases Parasitic Bloom Leech", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyStatuses: { poison: 8 },
      gearEffects: { leechHealBonusPercent: 50 },
      trinketEffects: { parasiticBloomLeechChance: 100 },
    });
    const result = tickEnemyStatuses(state, []);
    expect(result.playerHealth).toBe(16);
  });

  it("Sanguine Gear increases Bloodfire Signet Leech", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 8 }] });
    const state = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      playerHealth: 10,
      playerMaxHealth: 100,
      gearEffects: { leechHealBonusPercent: 50, burnBleedMirrorAndLeech: 1 },
    });
    expect(playBattleCardResolved(state, card.id, 0).state.playerHealth).toBe(16);
  });
});
