import { getBattleRng, rollPercent, type Rng } from "@/lib/rng";

export function rollBattleChance(chance: number, state: { rng?: Rng }): boolean {
  if (Number.isNaN(chance)) throw new Error("rollBattleChance requires a number");
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}
