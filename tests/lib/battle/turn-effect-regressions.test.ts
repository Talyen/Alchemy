import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { cardById } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("card costs and turn-start effects", () => {
  it("pays a corrupted card's Health cost despite damage reduction", () => {
    const card = makeTestCard({
      effects: [
        { kind: "lose-health", amount: 2 },
        { kind: "heal", amount: 4 },
      ],
    });
    const state = patchBattleState({ hand: [card], playerHealth: 10, talentEffects: { damageReduction: 5 } });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.playerHealth).toBe(12);
  });

  it("Cauterize respects Burn resistance and adds no resisted Burn buildup", () => {
    const card = cardById.cauterize!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 10,
      playerStatuses: { poison: 3 },
      gearEffects: { resistBurn: 100 },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.playerHealth).toBe(10);
    expect(result.playerStatuses).toMatchObject({ poison: 0, burn: 0 });
  });

  it("Bread's delayed overhealing triggers Clean Slate", () => {
    const card = cardById.bread!;
    const state = patchBattleState({ hand: [card], playerHealth: 10, playerMaxHealth: 14 });
    const eaten = playBattleCardResolved(state, card.id, 0).state;
    const result = advanceToPlayerTurn({
      ...eaten,
      playerStatuses: { ...eaten.playerStatuses, poison: 3 },
      talentEffects: { ...eaten.talentEffects, cleanseOnCardOverheal: true },
    });
    expect(result.playerStatuses.poison).toBe(0);
  });

  it.each(["scheduled damage", "Mask"])("cancels a queued Wish after a %s kill", (source) => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 1,
      playerStatuses: { poison: source === "Mask" ? 2 : 0 },
      trinketEffects: { plagueDoctorPoisonCleanse: source === "Mask" ? 2 : 0 },
      talentEffects: { goldOnWish: 5 },
      pendingTurnStartEffects: [
        { remainingTurns: 1, effects: [{ kind: "damage", damageType: "physical", amount: 10 }] },
        { remainingTurns: 1, effects: [{ kind: "wish", amount: 1 }] },
      ],
    });
    const result = advanceToPlayerTurn(state);
    expect(result.enemyHealth).toBe(0);
    expect(result.wishOptions).toBeNull();
    expect(result.gold).toBe(state.gold);
  });

  it("does not award Poison Leech after Burn has killed the enemy", () => {
    const state = patchBattleState({
      playerHealth: 10,
      enemyHealth: 1,
      enemyStatuses: { burn: 2, poison: 8 },
      talentEffects: { poisonLeechChance: 100 },
    });
    const result = tickEnemyStatuses(state, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(10);
  });
});
