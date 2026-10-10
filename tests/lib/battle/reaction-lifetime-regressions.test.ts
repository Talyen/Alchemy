import { describe, expect, it } from "vitest";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { purgeOnePlayerBenefit } from "@/lib/battle/player-purge";
import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { companionLibrary, cardById } from "@/lib/game-data";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { patchBattleState } from "../../fixtures/battle";

describe("reaction lifetimes", () => {
  it("a Companion attack can trigger the enemy's once-per-turn Holy Retribution", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.skeleton,
      currentEnemy: { traits: [{ id: "holy-retribution", title: "Holy Retribution", description: "" }] },
      rng: () => 0.99,
    });
    const first = processCompanionTurnStart(state, []);
    expect(first.playerHealth).toBe(state.playerHealth - 1);
    expect(first.flags.holyRetributionUsedThisTurn).toBe(true);
    expect(processCompanionTurnStart(first, []).playerHealth).toBe(first.playerHealth);
  });

  it("The Unclosing Wound retains Leech for the remaining Bleed ticks", () => {
    const state = patchBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 8 },
      pendingBleedLeechHealing: 8,
      gearEffects: { bleedDecaysByHalf: 1 },
      rng: () => 0.99,
    });
    const first = tickEnemyStatuses(state, []);
    expect(first.playerHealth).toBe(9);
    expect(first.pendingBleedLeechHealing).toBe(4);
    const second = tickEnemyStatuses(first, []);
    expect(second.playerHealth).toBe(11);
    expect(second.pendingBleedLeechHealing).toBe(2);
  });

  it("Forged Bulwark does not reward Block removed by an enemy Purge", () => {
    const state = patchBattleState({
      playerStatuses: { block: 3 },
      talentEffects: { forgeOnBlockDepleted: 1 },
      rng: () => 0.99,
    });
    const result = purgeOnePlayerBenefit(state, []).state;
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.forge).toBe(0);
  });

  it("Counterplate retaliates against Caustic's explicit Armor removal", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 1 },
      gearEffects: { stunOnArmorLostToAttack: 2, damageReductionPerMana: 1 },
      currentEnemy: { traits: [{ id: "caustic", title: "Caustic", description: "" }] },
      rng: () => 0.99,
    });
    const result = processEncounterTraitActionDamage(state, []);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.enemyHealth).toBe(state.enemyHealth - 2);
  });

  it("The Final Spark preserves its damage repeat when Smelling Salts has no damage to repeat", () => {
    const salts = cardById["smelling-salts"]!;
    const state = patchBattleState({
      hand: [salts],
      mana: 1,
      playerStatuses: { freeze: 1 },
      gearEffects: { lastManaElementalRepeat: 1, manaOnCleanse: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, salts.id, 0).state;
    expect(result.mana).toBe(1);
    expect(result.uniqueGear.finalSparkUsed).toBe(false);
    const fireball = cardById["fireball"]!;
    const attack = playBattleCardResolved({ ...result, hand: [fireball] }, fireball.id, 0).state;
    expect(attack.enemyHealth).toBe(state.enemyHealth - 4);
    expect(attack.uniqueGear.finalSparkUsed).toBe(true);
  });

  it("Deep Siphon applies to a card's deferred Bleed Leech after save and resume", () => {
    let rolls = 0;
    const fangs = cardById.fangs!;
    const state = patchBattleState({
      hand: [fangs],
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      gearEffects: { flatBleedDamage: 18 },
      talentEffects: { cardLeechHealingBonus: 1 },
      rng: () => (rolls++ === 0 ? 0 : 0.99),
    });
    const hit = playBattleCardResolved(state, fangs.id, 0).state;
    expect(hit.enemyStatuses.bleed).toBe(20);
    expect(hit.playerHealth).toBe(21);
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(hit)));
    const ticked = tickEnemyStatuses({ ...restored, rng: () => 0.99 }, []);
    expect(ticked.playerHealth).toBe(32);
    expect(ticked.pendingCardBleedLeechHealing).toBe(0);
    expect(detonateEnemyStatuses({ ...restored, rng: () => 0.99 }, ["bleed"], []).playerHealth).toBe(32);
    const lingering = tickEnemyStatuses(
      {
        ...restored,
        gearEffects: { ...restored.gearEffects, bleedDecaysByHalf: 1 },
        rng: () => 0.99,
      },
      [],
    );
    expect(lingering.pendingCardBleedLeechHealing).toBe(10);
    expect(tickEnemyStatuses(lingering, []).playerHealth).toBe(38);
    const mixed = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 40 },
      pendingBleedLeechHealing: 40,
      pendingCardBleedLeechHealing: 20,
      talentEffects: { cardLeechHealingBonus: 1 },
      rng: () => 0.99,
    });
    expect(tickEnemyStatuses(mixed, []).playerHealth).toBe(31);
  });
});
