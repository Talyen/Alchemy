import { current } from "immer";
import { canPlayCard, chooseWishCard, playBattleCardResolved } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  awardCardXP,
  setBattleState,
  withDraftWorldBattleRng,
  snapshotBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { PLAYABLE_HAND_OPTIONS } from "./playable-hand";

export function commitCardPlay(index: number, cardId: string) {
  return dispatchRunSessionCommand((draft) => {
    const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
    const card = bound.hand[index];
    if (!card || card.id !== cardId || !canPlayCard(bound, card, index, PLAYABLE_HAND_OPTIONS)) return null;
    const resolution = playBattleCardResolved(bound, card.id, index, PLAYABLE_HAND_OPTIONS);
    setBattleState(draft, resolution.state);
    awardCardXP(draft, card);
    return { ...resolution, state: snapshotBattleState(resolution.state) };
  });
}

export function commitBattleWish(cardId: string) {
  return dispatchRunSessionCommand((draft) => {
    const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
    if (!bound.wishOptions?.some((option) => option.id === cardId)) return null;
    const next = chooseWishCard(bound, cardId);
    setBattleState(draft, next);
    discoverCardIds(draft, [cardId]);
    return snapshotBattleState(next);
  });
}
