import { getBattleRng, rollPercent, type Rng } from "@/lib/rng";

export function rollBattleChance(chance: number, state: { rng?: Rng }): boolean {
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}
