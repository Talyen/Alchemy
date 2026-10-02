import { describe, expect, it } from "vitest";
import { cardById, companionLibrary } from "@/lib/game-data";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { applyDrawResult, drawFromState } from "@/lib/battle/draw";
import { advanceToPlayerTurn, resolveDeathsDoorGraceExpiry } from "@/lib/battle/player-turn-transition";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyEnemyHealingWithCombatText } from "@/lib/battle/enemy-healing";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createMixedPotion } from "@/lib/alchemist";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import type { BattleState } from "@/lib/battle";
import { patchBattleState } from "../../fixtures/battle";
import { parseActiveRunData } from "../../fixtures/active-run";

function resume(overrides: Record<string, unknown> = {}) {
  const saved = {
    ...patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [] },
      deck: [cardById.slash!],
    }),
    ...overrides,
  };
  return { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(saved))), rng: () => 0.99 };
}

describe("damaged battle save recovery", () => {
  it("keeps new draws distinct when the saved draw counter trails existing cards", () => {
    const restored = resume({
      hand: [{ ...cardById.slash!, uid: 1 }],
      pendingHandCards: [{ ...cardById.block!, uid: 20 }],
      nextCardUid: 1,
    });
    const drawn = applyDrawResult(restored, drawFromState(restored, 1));
    expect(drawn.hand.map((card) => card.uid)).toEqual([1, 20, 21]);
    expect(drawn.nextCardUid).toBe(22);
  });

  it("recovers Companion identity instead of executing an incomplete saved definition", () => {
    const restored = resume({ activeCompanion: { id: "wolf" } });
    expect(restored.activeCompanion).toEqual(companionLibrary.wolf);
    expect(processCompanionTurnStart(restored, []).enemyHealth).toBeLessThan(restored.enemyHealth);
    expect(resume({ activeCompanion: { id: "missing-companion" } }).activeCompanion).toBeNull();
  });

  it("keeps a scheduled Blizzard hit when another saved pulse is malformed", () => {
    const restored = resume({
      pendingTurnStartEffects: [
        {
          remainingTurns: 1,
          effects: [{ kind: "damage", damageType: "freeze", amount: 2 }],
          sourceCard: { id: "blizzard" },
        },
        { remainingTurns: "invalid", effects: [] },
      ],
    });
    expect(advanceToPlayerTurn(restored).enemyHealth).toBe(98);
  });

  it("keeps Returning Gale's valid arrow when another saved echo is malformed", () => {
    const restored = resume({
      gearEffects: { ...patchBattleState().gearEffects, archeryEchoNextTurn: 1 },
      uniqueGear: { ...patchBattleState().uniqueGear, archeryEchoes: [cardById["fire-arrow"]!, null] },
    });
    expect(advanceToPlayerTurn(restored).enemyHealth).toBeLessThan(100);
  });

  it("prevents enemy healing from removing Health after an out-of-range saved Health value", () => {
    const restored = resume({ enemyHealth: 100, enemyMaxHealth: 50 });
    expect(restored.enemyHealth).toBe(50);
    expect(applyEnemyHealingWithCombatText(restored, 4, []).enemyHealth).toBe(restored.enemyHealth);
    expect(resume({ enemyMaxHealth: 0 }).enemyMaxHealth).toBeGreaterThan(0);
  });

  it("lets Resonant Chimes earn Mana again after an invalid saved play count", () => {
    let restored: BattleState = resume({
      cardsPlayedThisTurn: "invalid",
      mana: 0,
      hand: [1, 2, 3].map((uid) => ({ ...cardById.slash!, cost: 0, uid })),
      trinketEffects: { ...patchBattleState().trinketEffects, resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
    });
    for (let index = 0; index < 3; index += 1) restored = playBattleCardResolved(restored, "slash", 0).state;
    expect(restored.cardsPlayedThisTurn).toBe(3);
    expect(restored.mana).toBe(1);
  });

  it("reserves excess saved hand cards ahead of newer queued cards without losing them", () => {
    const restored = resume({
      hand: Array.from({ length: MAX_HAND_SIZE + 1 }, (_, index) => ({ ...cardById.slash!, uid: index + 1 })),
      pendingHandCards: [{ ...cardById.block!, uid: 50 }],
    });
    expect(restored.hand).toHaveLength(MAX_HAND_SIZE);
    expect(restored.pendingHandCards.map((card) => card.uid)).toEqual([MAX_HAND_SIZE + 1, 50]);
  });

  it("drops an unrecoverable Mixed Potion rather than stranding it in the resumed deck", () => {
    const mixed = createMixedPotion(cardById["health-potion"]!, cardById["mana-potion"]!);
    const broken = { ...mixed, cost: -1, effects: [], descriptionLines: [] };
    const restored = parseActiveRunData({
      runDeck: [broken, cardById.slash!],
      activeCombat: { battleState: { ...patchBattleState(), hand: [broken], deck: [cardById.slash!] } },
    });
    expect(restored.runDeck.map((card) => card.id)).toEqual(["slash"]);
    expect(restored.activeCombat!.battleState.hand).toEqual([]);
    expect(parseActiveRunData({ runDeck: [mixed] }).runDeck[0]?.effects).toEqual(mixed.effects);
  });

  it("allows Death's Door to expire after a malformed saved grace countdown", () => {
    let restored: BattleState = resume({
      deathsDoorActive: true,
      deathsDoorUsed: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: "invalid",
      playerHealth: 1,
    });
    for (let turn = 0; turn < 5; turn += 1) restored = resolveDeathsDoorGraceExpiry(advanceToPlayerTurn(restored));
    expect(restored.deathsDoorActive).toBe(false);
    expect(restored.deathsDoorGraceTurnsRemaining).toBeNull();
  });
});
