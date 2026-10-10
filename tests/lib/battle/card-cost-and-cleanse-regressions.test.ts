import { describe, expect, it, vi } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createMixedPotion } from "@/lib/alchemist";
import { cardById } from "@/lib/game-data";
import { presentCombatTexts } from "@/features/alchemy/run-loop/battle/controller-utils";
import { patchBattleState } from "../../fixtures/battle";

describe("combat interaction bug regressions", () => {
  it("Winter's Credit spends Block without presenting a hit on the hero", () => {
    const card = cardById.frostbolt!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 3 },
      gearEffects: { blockPaysFreezeMana: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.playerStatuses.block).toBe(0);
    expect(result.state.playerHealth).toBe(state.playerHealth);
    expect(result.combatTexts).toContainEqual(expect.objectContaining({ stat: "block", amount: 3 }));
    const presenter = { showCombatTexts: vi.fn(), shakeEnemy: vi.fn(), shakePlayer: vi.fn() };
    presentCombatTexts(presenter, result.combatTexts);
    expect(presenter.shakeEnemy).toHaveBeenCalledOnce();
    expect(presenter.shakePlayer).not.toHaveBeenCalled();
  });

  it("Meteor's temporary Mana loss does not shake the hero's portrait", () => {
    const card = cardById.meteor!;
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      maxMana: 3,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.maxMana).toBe(3);
    expect(result.state.playerHealth).toBe(state.playerHealth);
    expect(result.combatTexts).toContainEqual(expect.objectContaining({ stat: "mana", amount: 1 }));
    const presenter = { showCombatTexts: vi.fn(), shakeEnemy: vi.fn(), shakePlayer: vi.fn() };
    presentCombatTexts(presenter, result.combatTexts);
    expect(presenter.shakeEnemy).toHaveBeenCalledOnce();
    expect(presenter.shakePlayer).not.toHaveBeenCalled();
  });

  it("an ineffective Panacea and Mana Potion brew reports its outcome", () => {
    const card = createMixedPotion(cardById["panacea-potion"]!, cardById["mana-potion"]!);
    const state = patchBattleState({ hand: [card], mana: 4, maxMana: 3 });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.exhausted).toContainEqual(card);
    expect(result.combatTexts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "notice", text: "Nothing to Cleanse" }),
    );
  });
});
