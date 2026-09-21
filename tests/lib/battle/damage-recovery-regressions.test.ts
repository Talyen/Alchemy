import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("damage and recovery interactions", () => {
  it("pending enemy Bleed Leech survives Phoenix Feather recovery", () => {
    const state = regressionBattle({
      playerHealth: 1,
      playerMaxHealth: 40,
      playerStatuses: { bleed: 3, phoenixFeather: 1 },
      pendingEnemyBleedLeechHealing: 3,
      enemyHealth: 20,
      enemyMaxHealth: 40,
    });
    const result = tickPlayerStatuses(state, []);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.enemyHealth).toBe(21);
    expect(result.pendingEnemyBleedLeechHealing).toBe(0);
  });

  it("stops trait pulses when healing from Flesheater defeats Blood Countess", () => {
    const state = regressionBattle({
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 1,
      currentEnemy: {
        traits: ["blood-countess", "flesheater", "toxic"].map((id) => ({ id, title: "", description: "" })),
      },
      talentEffects: { cleanseBelowHealthPercent: 25 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 6 },
    });
    const result = processEncounterTraitActionDamage(state, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.poison).toBe(0);
  });

  it.each(["block", "armor"] as const)("Rupture requires damage through enemy %s", (defense) => {
    const card = cardById.slash!;
    const state = regressionBattle({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { [defense]: 10 },
      enemyStatuses: { bleed: 8 },
      talentEffects: { physicalDetonatesBleed: true },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(100);
    expect(result.enemyStatuses.bleed).toBe(8);
  });

  it("self-inflicted Burn retains buildup through Phoenix Feather recovery", () => {
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType: "burn", amount: 1 }] });
    const state = regressionBattle({
      playerHealth: 1,
      playerMaxHealth: 40,
      playerStatuses: { phoenixFeather: 1 },
    });
    const result = applyCardEffects(state, card, []);
    expect(result.playerHealth).toBeGreaterThan(0);
    expect(result.playerStatuses.burn).toBe(1);
  });

  it("Stone Titan earns its Health-hit reward even when Phoenix Feather restores the hero", () => {
    const state = regressionBattle({
      playerHealth: 1,
      playerMaxHealth: 40,
      playerStatuses: { phoenixFeather: 1 },
      currentEnemy: { traits: [{ id: "stone-titan", title: "Stone Titan", description: "" }] },
    });
    const result = applyEnemyAbility(state, cardById.bash!, []);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.enemyMitigation.armor).toBe(state.enemyMitigation.armor + 1);
  });

  it("Flesheater earns immediate Leech when Last Resort cleanses its Bleed and heals the hero", () => {
    const state = regressionBattle({
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 20,
      enemyMaxHealth: 40,
      currentEnemy: { traits: [{ id: "flesheater", title: "Flesheater", description: "" }] },
      talentEffects: { cleanseBelowHealthPercent: 25 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 6 },
    });
    const result = processEncounterTraitActionDamage(state, []);
    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.bleed).toBe(0);
    expect(result.pendingEnemyBleedLeechHealing).toBe(0);
    expect(result.enemyHealth).toBe(21);
  });

  it("Crushing Force still triggers when a Health threshold replaces broken Block", () => {
    const state = regressionBattle({
      playerHealth: 21,
      playerMaxHealth: 40,
      playerStatuses: { block: 1 },
      talentEffects: { healthThresholdBlock: { threshold: 50, amount: 4 } },
      currentEnemy: { traits: [{ id: "earth-elemental", title: "Crushing Force", description: "" }] },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 3 }, []);
    expect(result.playerHealth).toBe(19);
    expect(result.playerStatuses.block).toBe(3);
  });
});
