import { setBattleState, setBattleStartState } from "./write/run-battle";
import { battleSnapshot, resolveBattleTurn, type ResolvedBattleTurn } from "@/lib/battle";
import { awardBattleDodgeXP, createDraftRunRandomSource } from "./run-session-write-port";
import { current } from "immer";
import { canPlayCard, chooseWishCard, playBattleCardResolved } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardCardXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { commitResolvedBattle, withDraftWorldBattleRng } from "./write/run-battle";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { PLAYABLE_HAND_OPTIONS } from "../config/battle-input";

export function commitCardPlay(index: number, cardId: string) {
  return dispatchRunSessionCommand((draft) => {
    const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
    const card = bound.hand[index];
    if (!card || card.id !== cardId || !canPlayCard(bound, card, index, PLAYABLE_HAND_OPTIONS)) return null;
    const resolution = playBattleCardResolved(bound, card.id, index, PLAYABLE_HAND_OPTIONS);
    commitResolvedBattle(draft, bound, resolution.state);
    awardCardXP(draft, card);
    return { ...resolution, state: battleSnapshot(resolution.state) };
  });
}

export function commitBattleWish(cardId: string) {
  return dispatchRunSessionCommand((draft) => {
    const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
    if (!bound.wishOptions?.some((option) => option.id === cardId)) return null;
    const next = chooseWishCard(bound, cardId);
    commitResolvedBattle(draft, bound, next);
    discoverCardIds(draft, [cardId]);
    return battleSnapshot(next);
  });
}

export function commitEndTurn(): ResolvedBattleTurn {
  return dispatchRunSessionCommand((draft) => {
    const before = current(draft.battle.battleState);
    const result = resolveBattleTurn(before, { rng: createDraftRunRandomSource(draft, "world") });
    awardBattleDodgeXP(draft, before, result.state);
    commitResolvedBattle(draft, before, result.state);
    return result;
  });
}

export function clearBattleOpeningState(): void {
  dispatchRunSessionCommand((draft) => setBattleStartState(draft, null));
}

export function commitDevBattleVictory(): void {
  if (!import.meta.env.DEV) return;
  dispatchRunSessionCommand((draft) => {
    setBattleState(draft, (state) => ({ ...state, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  });
}
