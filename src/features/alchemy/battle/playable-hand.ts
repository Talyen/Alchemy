import type { BattleState } from "@/lib/battle";
import { getEffectiveCost } from "@/lib/battle";

export function getPlayableHandCardKeys(
  battleState: Pick<
    BattleState,
    "hand" | "turnPhase" | "mana" | "wishOptions" | "flags" | "talentEffects" | "trinketEffects"
  >,
): Set<string> {
  if (battleState.turnPhase !== "player" || battleState.wishOptions) return new Set<string>();
  const costState = {
    flags: battleState.flags,
    talentEffects: battleState.talentEffects,
    trinketEffects: battleState.trinketEffects,
  };
  return new Set(
    battleState.hand
      .filter((card) => battleState.mana >= getEffectiveCost(costState, card))
      .map((card) => `${card.id}-${card.uid}`),
  );
}
