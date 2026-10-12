import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { readBattle } from "./run-reads";
import { clearBattlePresentationUi } from "./run-lifecycle";
import { createBattleStartCommands, type BattleStarted } from "./battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { acceptCommand, rejectCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardCardXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveBattleAction, type ResolvedBattleTurn } from "@/lib/battle";
import { current } from "immer";
import { PLAYABLE_HAND_OPTIONS } from "../config/battle-input";
import { awardBattleDodgeXP, createDraftRunRandomSource } from "./run-session-write-port";
import { commitResolvedBattle, setBattleState } from "./write/run-battle";

export function commitCardPlay(index: number, cardId: string, gameSession: GameSession) {
  return dispatchGameplayCommand(
    (draft) => {
      if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle", null);
      const before = current(draft.session.activity.data.battleState);
      const result = resolveBattleAction(
        before,
        { kind: "card", cardId, index, options: PLAYABLE_HAND_OPTIONS },
        { rng: createDraftRunRandomSource(draft, "world") },
      );
      if (result.kind === "rejected") return rejectCommand(result.reason, null);
      if (result.action !== "card") throw new Error("Unexpected battle action result");
      const resolution = result.resolution;
      commitResolvedBattle(draft, before, resolution.state);
      awardCardXP(draft, result.card);
      return acceptCommand(resolution);
    },
    undefined,
    gameSession,
  );
}

export function commitBattleWish(cardId: string, gameSession: GameSession) {
  return dispatchGameplayCommand(
    (draft) => {
      if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle", null);
      const before = current(draft.session.activity.data.battleState);
      const result = resolveBattleAction(
        before,
        { kind: "wish", cardId },
        { rng: createDraftRunRandomSource(draft, "world") },
      );
      if (result.kind === "rejected") return rejectCommand(result.reason, null);
      if (result.action !== "wish") throw new Error("Unexpected battle action result");
      const next = result.resolution.state;
      commitResolvedBattle(draft, before, next);
      discoverCardIds(draft, next.discoveredCardIds);
      return acceptCommand(next);
    },
    undefined,
    gameSession,
  );
}

export function commitEndTurn(gameSession: GameSession): ResolvedBattleTurn | null {
  return dispatchGameplayCommand(
    (draft) => {
      if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle", null);
      const before = current(draft.session.activity.data.battleState);
      const action = resolveBattleAction(
        before,
        { kind: "end-turn" },
        { rng: createDraftRunRandomSource(draft, "world") },
      );
      if (action.kind === "rejected") return rejectCommand(action.reason, null);
      if (action.action !== "end-turn") throw new Error("Unexpected battle action result");
      const result = action.resolution;
      awardBattleDodgeXP(draft, before, result.state);
      commitResolvedBattle(draft, before, result.state);
      return acceptCommand(result);
    },
    undefined,
    gameSession,
  );
}

function commitDevBattleVictory(gameSession: GameSession): void {
  if (!import.meta.env.DEV) return;
  dispatchGameplayCommand(
    (draft) => {
      if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle", undefined);
      setBattleState(draft, (state) => ({ ...state, enemyHealth: 0, wishOptions: null, wishQueue: [] }));

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
}

export function createBattleCapabilities(gameSession: GameSession) {
  return bindSessionCapabilities(gameSession, {
    read: () => readBattle(gameSession),
    playCard: (index: number, cardId: string) => commitCardPlay(index, cardId, gameSession),
    chooseWish: (cardId: string) => commitBattleWish(cardId, gameSession),
    endTurn: () => commitEndTurn(gameSession),
    devVictory: () => commitDevBattleVictory(gameSession),
    clearPresentation: () => clearBattlePresentationUi(gameSession),
    createStartCommands: (onStarted: (result: BattleStarted) => void) =>
      createBattleStartCommands(onStarted, gameSession),
  });
}

export type BattleCapabilities = ReturnType<typeof createBattleCapabilities>;
