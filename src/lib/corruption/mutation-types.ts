import type { BattleCard } from "@/lib/game-data";
import type { CORRUPTION_OUTCOME_WEIGHTS } from "@/lib/game-constants";

export interface Mutation {
  card: BattleCard;
  delta: 1 | -1;
}

export interface CorruptionMutationGroup {
  kind: keyof typeof CORRUPTION_OUTCOME_WEIGHTS;
  weight: number;
  mutations: Mutation[];
}
