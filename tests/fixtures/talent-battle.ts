import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { BattleCard, KeywordId } from "@/lib/game-data";
import { computeTalentEffects } from "@/lib/game-data/talents/compute";
import { patchBattleState, type BattleStatePatch } from "./battle";
import { makeTestCard } from "./cards";

export function talents(keyword: KeywordId, ...ids: string[]) {
  return computeTalentEffects({ [keyword]: ids });
}

export function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 30,
    playerMaxHealth: 30,
    mana: 20,
    maxMana: 20,
    rng: () => 0.99,
    ...patch,
  });
}

export function attack(
  id: string,
  damageType: "physical" | "nature" | "bleed" | "holy" = "physical",
  amount = 2,
): BattleCard {
  return makeTestCard({
    id,
    uid: Number(id.replace(/\D/g, "")) || 1,
    cost: 1,
    effects: [{ kind: "damage", damageType, amount }],
  });
}

export function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [...state.hand, card] }, card.id, state.hand.length).state;
}
