import { canPlayCard, type BattleState, type CardPlayOptions } from "@/lib/battle";

const PLAYABLE_HAND_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function getPlayableHandCardKeys(battleState: BattleState): Set<string> {
  return new Set(
    battleState.hand
      .filter((card, index) => canPlayCard(battleState, card, index, PLAYABLE_HAND_OPTIONS))
      .map((card) => `${card.id}-${card.uid}`),
  );
}

export function getPlayableHandCardKeysExcludingHidden(
  battleState: BattleState,
  hiddenHandCardKeys: Set<string>,
): Set<string> {
  const playable = getPlayableHandCardKeys(battleState);
  if (hiddenHandCardKeys.size === 0) return playable;
  for (const hiddenKey of hiddenHandCardKeys) {
    playable.delete(hiddenKey);
  }
  return playable;
}
