import { canPlayCard, type BattleState, type CardPlayOptions } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

export const PLAYABLE_HAND_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function findFirstPlayableHandCard(
  state: BattleState,
  options: CardPlayOptions = PLAYABLE_HAND_OPTIONS,
): { card: BattleCard; index: number } | null {
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (canPlayCard(state, card, index, options)) {
      return { card, index };
    }
  }
  return null;
}

export function handHasPlayableCard(state: BattleState, options: CardPlayOptions = PLAYABLE_HAND_OPTIONS): boolean {
  return findFirstPlayableHandCard(state, options) !== null;
}

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
