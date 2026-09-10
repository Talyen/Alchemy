import { describe, expect, it } from "vitest";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { companionLibrary } from "@/lib/game-data";

describe("combat reward sources", () => {
  it("Blood Debt increases healing from queued Bleed Leech", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 26,
      enemyStatuses: { bleed: 4 },
      pendingBleedLeechHealing: 4,
      talentEffects: { leechMissingHealthStep: 8 },
    });
    expect(tickEnemyStatuses(state, []).playerHealth).toBe(14);
  });

  it("Mana Siphon and Siphoning gear reward Poison Leech", () => {
    const state = patchBattleState({
      rng: () => 0,
      mana: 0,
      maxMana: 5,
      playerHealth: 10,
      enemyStatuses: { poison: 4 },
      talentEffects: { poisonLeechChance: 100, manaOnLeechChance: 100 },
      gearEffects: { manaOnLeechChance: 100 },
    });
    expect(tickEnemyStatuses(state, []).mana).toBe(2);
  });

  it("direct Leech grants each Mana reward once even at full Health", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      maxMana: 5,
      talentEffects: { manaOnLeechChance: 100 },
      gearEffects: { manaOnLeechChance: 100 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4, lifesteal: true }] });
    expect(dealDamage(state, card).mana).toBe(2);
  });

  it("Golden Crucible Forge triggers Overheat without scaling the Gold conversion", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerStatuses: { forge: 3 },
      talentEffects: { forgeBurnThreshold: 5, forgeBurnDamage: 2 },
      gearEffects: { goldGrantsForgeAndHoly: 1 },
    });
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind: "gain-gold", amount: 2 }] }), []);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyHealth).toBe(state.enemyHealth - 2);
    expect(result.enemyStatuses.burn).toBe(2);
  });

  it("Second Wind cannot cancel rewards for Companion damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 51,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
      activeCompanion: companionLibrary.bear,
      talentEffects: { companionDamage: 2, blockOnCompanionDamage: 2 },
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.flags.secondWindTriggered).toBe(true);
    expect(result.enemyHealth).toBeGreaterThan(state.enemyHealth);
    expect(result.playerStatuses.block).toBe(2);
    const blocked = processCompanionTurnStart(
      { ...state, enemyMitigation: { ...state.enemyMitigation, block: 100 } },
      [],
    );
    expect(blocked.playerStatuses.block).toBe(0);
  });
});
