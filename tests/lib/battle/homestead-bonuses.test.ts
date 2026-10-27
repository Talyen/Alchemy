import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import { describe, expect, it, vi } from "vitest";
import { makeStateWithFailedRolls, makeTestCard } from "../../fixtures/battle";
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyHealingWithCombatText } from "@/lib/battle/player-rewards";
import { applyLeechHealing } from "@/lib/battle/stun-leech-resolution";
import { applyCardEffects } from "@/lib/battle/effect-handlers/registry";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import type { CombatTextEvent } from "@/lib/battle/types";

const talents = (changes: Partial<ReturnType<typeof createEmptyTalentEffectManifest>>) => ({
  ...createEmptyTalentEffectManifest(),
  ...changes,
});

describe("Homestead combat bonuses", () => {
  it("Leyline preserves Mana on a paid play without exposing a free cost or consuming an armed discount", () => {
    const card = makeTestCard({ cost: 2, effects: [] });
    const initial = makeStateWithFailedRolls({
      hand: [card],
      mana: 2,
      talentEffects: talents({ homesteadFreeManaChance: 100 }),
    });
    initial.flags.nextCardCostReduction = 1;
    expect(card.cost).toBe(2);
    expect(canPlayCard(initial, card, 0)).toBe(true);
    const result = playBattleCardResolved(initial, card.id, 0);
    expect(result.state.mana).toBe(2);
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.flags.nextCardCostReduction).toBe(1);
    expect(result.combatTexts.filter((event) => event.stat === "mana")).toHaveLength(0);
  });

  it("cannot roll an unaffordable play for free Mana", () => {
    const rng = vi.fn(() => 0);
    const card = makeTestCard({ cost: 1, effects: [] });
    const state = makeStateWithFailedRolls({
      rng,
      hand: [card],
      mana: 0,
      talentEffects: talents({ homesteadFreeManaChance: 100 }),
    });
    expect(canPlayCard(state, card, 0)).toBe(false);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4])(
    "Crystal Garden tier %i stacks with the Mana talent and uses Mana remaining after payment",
    (tier) => {
      const effects = mergeIntoManifest(
        talents({ freezeDamagePerMana: 25 }),
        computeHomesteadEffects({}, { "crystal-garden": tier }, {}),
      );
      const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 5 };
      const card = makeTestCard({ cost: 1, effects: [effect] });
      const initial = makeStateWithFailedRolls({
        mana: 5,
        maxMana: 5,
        hand: [card],
        talentEffects: effects,
        enemyHealth: 100,
        enemyMaxHealth: 100,
      });
      const result = playBattleCardResolved(initial, card.id, 0);
      expect(result.state.mana).toBe(4);
      expect(result.state.enemyHealth).toBe(100 - (5 + tier + 1));
      const noMana = { ...initial, mana: 0 };
      expect(computeCardDamageToEnemy(noMana, effect, card).modifiedDamage).toBe(5);
    },
  );

  it("Pasture reduces the existing Physical hit", () => {
    const state = makeStateWithFailedRolls({
      playerHealth: 100,
      playerMaxHealth: 100,
      talentEffects: talents({ physicalDamageReduction: 3 }),
    });
    const events: CombatTextEvent[] = [];
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 10 }, events);
    expect(result.playerHealth).toBe(93);
  });

  it("Culinary and Mycology strengthen the same healing result", () => {
    const state = makeStateWithFailedRolls({
      playerHealth: 10,
      playerMaxHealth: 100,
      talentEffects: talents({ homesteadHealing: 2, homesteadLeechHealing: 3 }),
    });
    const ordinary: CombatTextEvent[] = [];
    expect(applyHealingWithCombatText(state, 5, ordinary).playerHealth).toBe(17);
    expect(ordinary.filter((event) => event.kind === "heal")).toHaveLength(1);
    const leech: CombatTextEvent[] = [];
    expect(applyLeechHealing(state, 5, leech).playerHealth).toBe(20);
    expect(leech.filter((event) => event.kind === "heal")).toHaveLength(1);
    expect(applyHealingWithCombatText(state, 0, []).playerHealth).toBe(10);
  });

  it("Alchemy Lab strengthens Potion healing without adding Mana to the Potion", () => {
    const state = makeStateWithFailedRolls({
      mana: 0,
      maxMana: 5,
      playerHealth: 10,
      playerMaxHealth: 100,
      talentEffects: talents({ homesteadPotionBonus: 4 }),
    });
    const potion = makeTestCard({
      id: "health-potion",
      effects: [
        { kind: "heal", amount: 2 },
        { kind: "restore-mana", amount: 1 },
      ],
    });
    const result = applyCardEffects(state, potion, []);
    expect(result.playerHealth).toBe(16);
    expect(result.mana).toBe(1);
    const damage = { kind: "damage" as const, damageType: "holy" as const, amount: 5 };
    expect(computeCardDamageToEnemy(state, damage, potion).modifiedDamage).toBe(9);
  });

  it("Blacksmith uses the strongest Forge permission", () => {
    for (const [homesteadForgeBurnPercent, expected] of [
      [25, 12],
      [100, 14],
    ]) {
      const state = makeStateWithFailedRolls({
        talentEffects: talents({ homesteadForgeBurnPercent, forgeBurnDamagePercent: 50 }),
      });
      state.playerStatuses.forge = 4;
      const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 10 };
      expect(computeCardDamageToEnemy(state, effect, makeTestCard({ effects: [effect] })).modifiedDamage).toBe(
        expected,
      );
    }
  });
});
