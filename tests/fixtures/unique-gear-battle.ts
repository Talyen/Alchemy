import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { BattleState } from "@/lib/battle/types";
import { type BattleCard, type DamageType } from "@/lib/game-data";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "./battle";

export function battle(patch: BattleStatePatch = {}): BattleState {
  return patchBattleState({
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    playerHealth: 100,
    playerMaxHealth: 100,
    mana: 10,
    maxMana: 10,
    nextCardUid: 100,
    rng: () => 0.99,
    ...patch,
  });
}

export function attack(type: DamageType, extra: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({
    id: type,
    uid: 1,
    cost: 2,
    effects: [{ kind: "damage", damageType: type, amount: 10 }],
    ...extra,
  });
}

export function play(state: BattleState, card: BattleCard): BattleState {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0).state;
}
