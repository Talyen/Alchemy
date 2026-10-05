import { describe, expect, it, vi } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createMixedPotion } from "@/lib/alchemist";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { cardById, companionLibrary } from "@/lib/game-data";
import { presentCombatTexts } from "@/features/alchemy/run-loop/battle/controller-utils";
import { patchBattleState } from "../../fixtures/battle";

describe("combat interaction bug regressions", () => {
  it("Rimeheart checks Mana before Smithguard's cleanse rewards", () => {
    let rolls = 0;
    const state = patchBattleState({
      activeCompanion: companionLibrary["frost-whelp"],
      mana: 0,
      maxMana: 10,
      enemyHealth: 4,
      enemyMaxHealth: 100,
      playerStatuses: { forge: 1, poison: 1 },
      gearEffects: {
        companionBenefitsFromForge: 1,
        freezeGrantsBlockAndMana: 1,
        blockOnLastForgeSpent: 2,
        manaOnCleanse: 1,
      },
      talentEffects: { armorOnBlockChance: 10, armorCleanseChance: 10 },
      rng: () => (++rolls <= 2 ? 0.99 : 0),
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.block).toBe(4);
    expect(result.mana).toBe(3);
  });

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

  it("Meteor's Mana Crystal cost does not shake the hero's portrait", () => {
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
    expect(result.state.maxMana).toBe(2);
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
