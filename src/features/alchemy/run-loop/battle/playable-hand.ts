import type { BattleState } from "@/lib/battle";
import { getEffectiveCost } from "@/lib/battle";

export function getPlayableHandCardKeys(
  battleState: Pick<
    BattleState,
    "hand" | "turnPhase" | "mana" | "wishOptions" | "flags" | "talentEffects" | "boonEffects"
  >,
): Set<string> {
  if (battleState.turnPhase !== "player" || battleState.wishOptions) return new Set<string>();
  const costState = {
    flags: battleState.flags,
    talentEffects: battleState.talentEffects,
    boonEffects: battleState.boonEffects,
  };
  return new Set(
    battleState.hand
      .filter((card) => battleState.mana >= getEffectiveCost(costState, card))
      .map((card) => `${card.id}-${card.uid}`),
  );
}

export function getPlayableHandCardKeysExcludingHidden(
  battleState: Parameters<typeof getPlayableHandCardKeys>[0],
  hiddenHandCardKeys: Set<string>,
): Set<string> {
  const playable = getPlayableHandCardKeys(battleState);
  if (hiddenHandCardKeys.size === 0) return playable;
  for (const hiddenKey of hiddenHandCardKeys) {
    playable.delete(hiddenKey);
  }
  return playable;
}
