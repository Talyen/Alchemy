import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createMixedPotion } from "@/lib/alchemist";
import { cardById, computeTalentEffects, type BattleCard } from "@/lib/game-data";
import { makeCombatTexts, makeState } from "../../fixtures/battle";

describe("Mixed Potion combat mechanics", () => {
  const healthPotion = cardById["health-potion"]!;
  const manaPotion = cardById["mana-potion"]!;

  it("executes both Mana-derived benefits when mixing identical ingredients", () => {
    const ingredient: BattleCard = {
      ...healthPotion,
      effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 }],
    };
    const mixed = createMixedPotion(ingredient, ingredient);
    const state = makeState({ mana: 3, maxMana: 3 });
    expect(applyCardEffects(state, mixed, []).playerStatuses.block).toBe(12);
  });

  it("stacks Distillation and Brewmaster potency additively for Mixed Potions", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);
    const state = makeState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: computeTalentEffects({ consume: ["consume-distillation", "consume-brewmaster"] }),
    });
    const nextState = applyCardEffects(state, mixed, makeCombatTexts());
    expect(nextState.playerHealth).toBe(20);
  });

  it("deals Poison for a standard Potion use", () => {
    const state = makeState({
      hand: [healthPotion],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: { mortarPestlePoisonOnPotionUse: 1 },
    });

    const result = playBattleCardResolved(state, healthPotion.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(1);
  });

  it("deals Poison for a mixed Potion use", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);
    const state = makeState({
      hand: [mixed],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: { mortarPestlePoisonOnPotionUse: 1 },
    });

    const result = playBattleCardResolved(state, mixed.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(1);
  });

  it("does not trigger for a non-Potion card", () => {
    const card = {
      ...healthPotion,
      id: "ordinary-heal",
    };
    const state = makeState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: { mortarPestlePoisonOnPotionUse: 1 },
    });

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(0);
  });

  it("triggers once for each duplicated Potion use", () => {
    const state = makeState({
      hand: [healthPotion],
      playerHealth: 10,
      playerMaxHealth: 30,
      flags: { playNextCardTwice: true },
      trinketEffects: { mortarPestlePoisonOnPotionUse: 1 },
    });

    const result = playBattleCardResolved(state, healthPotion.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(2);
  });

  it("preserves nextHitCrit flag when triggering mortarPestlePoisonOnPotionUse", () => {
    const state = makeState({
      hand: [healthPotion],
      flags: { nextHitCrit: true },
      trinketEffects: { mortarPestlePoisonOnPotionUse: 2 },
    });
    const result = playBattleCardResolved(state, healthPotion.id, 0);
    expect(result.state.flags.nextHitCrit).toBe(true);
    expect(result.state.enemyStatuses.poison).toBe(2);
  });

  it("a Panacea and Mana Potion brew restores Health when there is nothing to cleanse", () => {
    const card = createMixedPotion(cardById["panacea-potion"]!, cardById["mana-potion"]!);
    const state = makeState({ hand: [card], mana: 4, maxMana: 3, playerHealth: 10, playerMaxHealth: 30 });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.exhausted).toContainEqual(card);
    expect(result.state.playerHealth).toBe(12);
    expect(result.combatTexts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "heal", stat: "health", amount: 2 }),
    );
  });
});
