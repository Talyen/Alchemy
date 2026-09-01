import { PERCENT_DENOMINATOR } from "../game-constants";

export const placeholderRng: () => number = () => 0;

export function rollPercent(chance: number, rng: () => number): boolean {
  return chance > 0 && rng() * PERCENT_DENOMINATOR < chance;
}

export function rollChance(probability: number, rng: () => number): boolean {
  return probability > 0 && rng() < probability;
}

export function getBattleRng(state: { rng?: () => number }): () => number {
  if (!state.rng) {
    throw new Error("BattleState.rng is required for outcome rolls");
  }
  return state.rng;
}
