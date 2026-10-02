import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import type { CombatTextEvent } from "@/lib/battle/types";
import { cardById, companionLibrary, describeCardEffects } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";

describe("combat hit regressions", () => {
  it.each(["armor", "block"] as const)("a lethal hit cannot retaliate through depleted %s", (defense) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 1,
      deathsDoorUsed: true,
      playerStatuses: { [defense]: 1 },
      gearEffects: { stunOnArmorLostToAttack: 2, stunOnBlockDepleted: 2 },
    });
    const next = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 3 }, []);
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(state.enemyHealth);
    expect(next.enemyStatuses.stun).toBe(0);
  });

  it("Phoenix Feather recovery does not hide the enemy hit's Health loss", () => {
    const state = patchBattleState({ playerHealth: 2, playerMaxHealth: 30, playerStatuses: { phoenixFeather: 1 } });
    const texts: CombatTextEvent[] = [];
    const next = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 4 }, texts);
    expect(next.playerHealth).toBe(9);
    expect(next.playerStatuses.phoenixFeather).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "health", amount: 2 });
  });

  it.each(["attack", "Poison tick"] as const)("Steadfast Armor survives the triggering %s", (source) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 16,
      playerMaxHealth: 30,
      playerStatuses: { poison: source === "Poison tick" ? 2 : 0 },
      talentEffects: { healthThresholdArmor: [{ threshold: 50, amount: 3 }] },
      gearEffects: { stunOnArmorLostToAttack: 2 },
    });
    const next =
      source === "attack"
        ? processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 2 }, [])
        : tickPlayerStatuses(state, []);
    expect(next.playerHealth).toBe(14);
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.enemyHealth).toBe(state.enemyHealth);
  });

  it("Flashpoint preserves The Knight's Answer for the following paid Physical card", () => {
    const slash = cardById.slash!;
    // A Corruption altar can add a Burn packet to a Physical card.
    const effects = [...slash.effects, { kind: "damage" as const, damageType: "burn" as const, amount: 1 }];
    const corruptedSlash = { ...slash, effects, descriptionLines: describeCardEffects(effects), uid: 1 };
    const ordinarySlash = { ...slash, uid: 2 };
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      hand: [corruptedSlash, ordinarySlash],
      talentEffects: { firstBurnCardFree: true },
      gearEffects: { blockReadiesFreePhysical: 1 },
      uniqueGear: { knightsAnswerReady: true },
    });
    const first = playBattleCardResolved(state, corruptedSlash.id, 0).state;
    expect(first.flags.firstBurnCardFreeUsed).toBe(true);
    expect(first.uniqueGear.knightsAnswerReady).toBe(true);
    const second = playBattleCardResolved(first, ordinarySlash.id, 0).state;
    expect(second.hand).toHaveLength(0);
    expect(second.uniqueGear.knightsAnswerReady).toBe(false);
    expect(second.mana).toBe(0);
  });

  it("Kinbound rechecks Health after Companion damage and enemy Thorns", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 16,
      playerMaxHealth: 30,
      activeCompanion: companionLibrary.wolf,
      enemyStatuses: { thorns: 2 },
      gearEffects: { healOnCompanionAttack: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const next = processCompanionTurnStart(state, texts);
    expect(next.enemyHealth).toBeLessThan(state.enemyHealth);
    expect(next.playerHealth).toBe(16);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });
});
