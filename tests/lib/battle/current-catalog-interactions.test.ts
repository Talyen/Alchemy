import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { patchBattleState } from "../../fixtures/battle";

describe("current catalog interactions", () => {
  it.each([7, 9, 10])("Mana Flare respects %i starting enemy Block after Meteor's hit", (block) => {
    const card = cardById["meteor"]!;
    const state = patchBattleState({
      hand: [card],
      maxMana: 3,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block },
      talentEffects: computeTalentEffects({ mana: ["mana-flare"] }),
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.maxMana).toBe(2);
    const flareDamage = 10 - block;
    expect(result.enemyHealth).toBe(100 - flareDamage);
    expect(result.enemyMitigation.block).toBe(0);
    expect(result.enemyStatuses.burn).toBe(flareDamage);
  });

  it.each([2, 3, 10])("Sun-Struck Shield checks depletion of all %i Block on a Sundered Guard attack", (block) => {
    const state = patchBattleState({
      playerStatuses: { block },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: computeTalentEffects({ block: ["block-reduce-burn"] }),
      currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, cardById["slash"]!, []);
    expect(result.playerStatuses.block).toBe(block === 10 ? 4 : 0);
    expect(result.enemyHealth).toBe(block === 10 ? 100 : 99);
  });
});
