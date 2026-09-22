import { describe, expect, it } from "vitest";
import { cardById, companionLibrary } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyBlockReward, removeHarmfulPlayerStatuses } from "@/lib/battle/combat-text";
import { applyPlayerStatusEffect } from "@/lib/battle/status-player";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { paceCombatMagnitude } from "@/lib/battle/fight-pacing";
import { patchBattleState } from "../../fixtures/battle";

describe("status reward interactions", () => {
  it("Panacea pays cleansing healing for each removed status, never empty slots", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 50,
      playerStatuses: { burn: 2, poison: 3, bleed: 4 },
      talentEffects: { healOnStatusCleanse: 2 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 6 },
    });
    const next = applyCardEffects(state, cardById["panacea-potion"]!, []);
    expect(next.playerHealth).toBe(34);
    expect(next.playerStatuses).toMatchObject({ burn: 0, poison: 0, bleed: 0 });
    expect(removeHarmfulPlayerStatuses(next, Infinity, []).playerHealth).toBe(34);
  });

  it("Tempered Guard boosts both card Block and triggered Block exactly once", () => {
    const state = patchBattleState({ playerStatuses: { forge: 6 }, talentEffects: { forgeBlockPercent: 50 } });
    expect(applyBlockReward(state, 2, []).playerStatuses.block).toBe(5);
    expect(
      applyPlayerStatusEffect(state, { kind: "player-status", status: "block", amount: 2 }, []).playerStatuses.block,
    ).toBe(5);
    expect(applyBlockReward(state, 0, []).playerStatuses.block).toBe(0);
  });

  it("paces the combined Tempered Guard grant once", () => {
    const state = patchBattleState({
      appliesFightPacing: true,
      turn: 12,
      playerStatuses: { forge: 6 },
      talentEffects: { forgeBlockPercent: 50 },
    });
    const expected = paceCombatMagnitude(state, 5, "player");
    expect(applyBlockReward(state, 2, []).playerStatuses.block).toBe(expected);
    expect(
      applyPlayerStatusEffect(state, { kind: "player-status", status: "block", amount: 2 }, []).playerStatuses.block,
    ).toBe(expected);
  });

  it("combines Footwork and Nimble before awarding Ironwood Buckler Thorns", () => {
    const state = patchBattleState({
      talentEffects: { dodgeBlockAmount: 2 },
      gearEffects: { blockOnDodge: 3 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 1 },
      rng: () => 0,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(true);
    expect(result.state.playerStatuses.block).toBe(5);
    expect(result.state.playerStatuses.thorns).toBe(1);
  });

  it("Forged Bulwark still rewards depletion when Desperate Guard refills Block", () => {
    const state = patchBattleState({
      playerHealth: 21,
      playerMaxHealth: 40,
      playerStatuses: { block: 1 },
      talentEffects: { forgeOnBlockDepleted: 1, healthThresholdBlockOnce: { threshold: 50, amount: 6 } },
      rng: () => 0.99,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: false,
    }).state;
    expect(next.playerHealth).toBe(18);
    expect(next.playerStatuses.block).toBe(6);
    expect(next.playerStatuses.forge).toBe(1);
  });

  it.each(["block refill", "healing"])("Watchdog uses depletion and Health before %s rewards", (reward) => {
    const state = patchBattleState({
      playerHealth: 21,
      playerMaxHealth: 40,
      playerStatuses: { block: 1 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      activeCompanion: companionLibrary.wolf,
      talentEffects: {
        companionAttackOnBlockDepletedBelowHalf: true,
        ...(reward === "block refill"
          ? { healthThresholdBlockOnce: { threshold: 50, amount: 6 } }
          : { blockDepletedHeal: 2 }),
      },
      rng: () => 0.99,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: false,
    }).state;
    expect(next.enemyHealth).toBeLessThan(100);
    expect(next.playerHealth).toBe(reward === "healing" ? 20 : 18);
  });
  it("does not trigger depletion rewards for partial Block loss", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      playerStatuses: { block: 5 },
      enemyHealth: 100,
      activeCompanion: companionLibrary.wolf,
      talentEffects: { companionAttackOnBlockDepletedBelowHalf: true, forgeOnBlockDepleted: 1 },
      rng: () => 0.99,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: false,
    }).state;
    expect(next.playerStatuses.block).toBe(1);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.enemyHealth).toBe(100);
  });
});
