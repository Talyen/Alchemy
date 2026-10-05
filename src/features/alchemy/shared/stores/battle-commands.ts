import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { acceptCommand, rejectCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardCardXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  battleSnapshot,
  canPlayCard,
  chooseWishCard,
  playBattleCardResolved,
  resolveBattleTurn,
  type ResolvedBattleTurn,
} from "@/lib/battle";
import { current } from "immer";
import { PLAYABLE_HAND_OPTIONS } from "../config/battle-input";
import { awardBattleDodgeXP, createDraftRunRandomSource } from "./run-session-write-port";
import { commitResolvedBattle, setBattleStartState, setBattleState, withDraftWorldBattleRng } from "./write/run-battle";

export function commitCardPlay(index: number, cardId: string, gameSession: GameSession = defaultGameSession) {
  return dispatchGameplayCommand(
    (draft) => {
      const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
      const card = bound.hand[index];
      if (!card || card.id !== cardId || !canPlayCard(bound, card, index, PLAYABLE_HAND_OPTIONS))
        return rejectCommand("Battle action is unavailable", null);
      const resolution = playBattleCardResolved(bound, card.id, index, PLAYABLE_HAND_OPTIONS);
      commitResolvedBattle(draft, bound, resolution.state);
      awardCardXP(draft, card);
      return acceptCommand({ ...resolution, state: battleSnapshot(resolution.state) });
    },
    undefined,
    gameSession,
  );
}

export function commitBattleWish(cardId: string, gameSession: GameSession = defaultGameSession) {
  return dispatchGameplayCommand(
    (draft) => {
      const bound = withDraftWorldBattleRng(draft, current(draft.battle.battleState));
      if (!bound.wishOptions?.some((option) => option.id === cardId))
        return rejectCommand("Battle action is unavailable", null);
      const next = chooseWishCard(bound, cardId);
      commitResolvedBattle(draft, bound, next);
      discoverCardIds(draft, next.discoveredCardIds);
      return acceptCommand(battleSnapshot(next));
    },
    undefined,
    gameSession,
  );
}

export function commitEndTurn(gameSession: GameSession = defaultGameSession): ResolvedBattleTurn {
  return dispatchGameplayCommand(
    (draft) => {
      const before = current(draft.battle.battleState);
      const result = resolveBattleTurn(before, { rng: createDraftRunRandomSource(draft, "world") });
      awardBattleDodgeXP(draft, before, result.state);
      commitResolvedBattle(draft, before, result.state);
      return acceptCommand(result);
    },
    undefined,
    gameSession,
  );
}

export function clearBattleOpeningState(gameSession: GameSession = defaultGameSession): void {
  dispatchGameplayCommand((draft) => acceptCommand(setBattleStartState(draft, null)), undefined, gameSession);
}

export function commitDevBattleVictory(gameSession: GameSession = defaultGameSession): void {
  if (!import.meta.env.DEV) return;
  dispatchGameplayCommand(
    (draft) => {
      setBattleState(draft, (state) => ({ ...state, enemyHealth: 0, wishOptions: null, wishQueue: [] }));

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
}
