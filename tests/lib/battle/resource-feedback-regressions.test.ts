import { describe, expect, it, vi } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { CombatTextEvent } from "@/lib/battle";
import { cardById, companionLibrary } from "@/lib/game-data";
import { presentCombatTexts } from "@/features/alchemy/run-loop/battle/controller-utils";
import { patchBattleState } from "../../fixtures/battle";

function presenter() {
  return { showCombatTexts: vi.fn(), shakeEnemy: vi.fn(), shakePlayer: vi.fn() };
}

describe("resource and Companion feedback regressions", () => {
  it("Laughing Guard spends Block on a Dodge without presenting a hit on the hero", () => {
    let rolls = 0;
    const state = patchBattleState({
      playerStatuses: { block: 8 },
      gearEffects: { dodgeSpendsPreservedBlock: 1 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => (rolls++ === 0 ? 0 : 0.99),
    });
    const texts: CombatTextEvent[] = [];
    const next = applyEnemyAbility(state, cardById.slash!, texts);
    expect(next.playerStatuses.block).toBe(4);
    expect(next.playerHealth).toBe(state.playerHealth);
    expect(next.enemyHealth).toBe(96);
    expect(texts).toContainEqual(expect.objectContaining({ target: "player", stat: "block", amount: 4 }));
    const feedback = presenter();
    presentCombatTexts(feedback, texts);
    expect(feedback.shakeEnemy).toHaveBeenCalledOnce();
    expect(feedback.shakePlayer).not.toHaveBeenCalled();
  });

  it("Sunder removes Armor without presenting Health damage", () => {
    const state = patchBattleState({ playerStatuses: { armor: 5 }, rng: () => 0.99 });
    const texts: CombatTextEvent[] = [];
    const next = applyEnemyAbility(state, cardById.sunder!, texts);
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.playerHealth).toBe(state.playerHealth);
    expect(texts).toContainEqual(expect.objectContaining({ target: "player", stat: "armor", amount: 2 }));
    const feedback = presenter();
    presentCombatTexts(feedback, texts);
    expect(feedback.shakePlayer).not.toHaveBeenCalled();
  });

  it("Eager Pack acknowledges an ineffective Wisp action after the summon notice", () => {
    const card = cardById["will-o-wisp-companion"]!;
    const state = patchBattleState({ hand: [card], encounterBenefits: ["eager-pack"], rng: () => 0.99 });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.activeCompanion).toEqual(companionLibrary["will-o-wisp"]);
    expect(result.state.playerStatuses).toEqual(state.playerStatuses);
    expect(result.combatTexts).toEqual([
      { target: "player", kind: "notice", stat: "companion", text: "" },
      { target: "player", kind: "notice", stat: "cleanse", text: "Nothing to Cleanse" },
    ]);
  });
});
