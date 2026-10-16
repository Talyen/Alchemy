import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById } from "@/lib/game-data";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const cinder = { id: "cinder-skin", title: "Cinder Skin", description: "" };
const countess = { id: "blood-countess", title: "Profane Blood", description: "" };

describe("player reaction boundaries", () => {
  it("Burning Wish settles Cinder Skin before Mana from a Wish can heal", () => {
    const card = cardById.wish!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 1,
      playerMaxHealth: 100,
      deathsDoorUsed: true,
      mana: card.cost,
      maxMana: 3,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [cinder] },
      talentEffects: { burnOnWish: 1, healthPerMana: 1 },
      gearEffects: { manaOnWish: 1 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.mana).toBe(0);
  });

  it("Plague Doctor's cleansing retaliation precedes the returned Poison hit", () => {
    const state = patchBattleState({
      turn: 2,
      playerHealth: 1,
      playerMaxHealth: 100,
      deathsDoorUsed: true,
      playerStatuses: { poison: 2 },
      enemyHealth: 2,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: { traits: [cinder, countess] },
      trinketEffects: { plagueDoctorPoisonCleanse: 2 },
      talentEffects: { healOnStatusCleanse: 1 },
      deck: [makeTestCard()],
      rng: () => 0.99,
    });
    const next = advanceToPlayerTurn(state);
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(1);
  });
});
