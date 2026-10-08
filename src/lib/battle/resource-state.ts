import type { BattleState } from "./types";
import type { GearEffectManifest } from "@/lib/gear";
import { applyPercentBonus } from "./amount-helpers";
import { PERCENT_DENOMINATOR } from "../game-constants";
export function gainMana(state: BattleState, amount: number, allowOverflow = false): BattleState {
  if (amount <= 0) return state;
  const mana = allowOverflow ? state.mana + amount : Math.max(state.mana, Math.min(state.maxMana, state.mana + amount));
  if (Object.is(mana, state.mana)) return state;
  return {
    ...state,
    mana,
  };
}

export function scaleGoldReward(baseGold: number, gear: GearEffectManifest): number {
  return applyPercentBonus(baseGold, gear.goldGainPercent, PERCENT_DENOMINATOR);
}
