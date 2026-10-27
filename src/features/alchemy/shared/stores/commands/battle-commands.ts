import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { readBattle } from "../session/run-reads";
import { clearBattlePresentationUi } from "./run-lifecycle";
import { createBattleStartCommands, type BattleStarted } from "./battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/session/gameplay-command";
import { discoverCardIds } from "@/features/alchemy/shared/stores/session/profile-store";
import { acceptCommand, rejectCommand } from "@/features/alchemy/shared/stores/commands/run-session-command";
import { awardCardXP } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { resolveBattleAction, type BattleSnapshot, type ResolvedBattleTurn } from "@/lib/battle";
import { current } from "immer";
import { PLAYABLE_HAND_OPTIONS } from "../../config/battle-input";
import { awardBattleDodgeXP, createDraftRunRandomSource } from "./run-session-write-port";
import { commitResolvedBattle, setBattleState } from "./write/run-battle";

type BattleAction = Parameters<typeof resolveBattleAction>[1];
type ResolvedPlayerAction = Extract<ReturnType<typeof resolveBattleAction>, { action: "card" }>["resolution"];

// Input borrows the immutable snapshot that offered it. Identity is the
// concurrency guard: IDs, turn numbers, and even complete saved values can recur
// in a later battle. Reject before creating RNG or awarding any progress.
function commitBattleInput(
  expected: BattleSnapshot,
  action: Extract<BattleAction, { kind: "card" }>,
  gameSession: GameSession,
): ResolvedPlayerAction | null;
function commitBattleInput(
  expected: BattleSnapshot,
  action: Extract<BattleAction, { kind: "wish" }>,
  gameSession: GameSession,
): BattleSnapshot | null;
function commitBattleInput(
  expected: BattleSnapshot,
  action: Extract<BattleAction, { kind: "end-turn" }>,
  gameSession: GameSession,
): ResolvedBattleTurn | null;
function commitBattleInput(expected: BattleSnapshot, action: BattleAction, gameSession: GameSession) {
  return dispatchGameplayCommand<ResolvedPlayerAction | ResolvedBattleTurn | BattleSnapshot | null>(
    (draft) => {
      if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle", null);
      const before = current(draft.session.activity.data.battleState);
      if (before !== expected) return rejectCommand("Battle input is stale", null);
      const result = resolveBattleAction(before, action, { rng: createDraftRunRandomSource(draft, "world") });
      if (result.kind === "rejected") return rejectCommand(result.reason, null);
      if (result.action !== action.kind) throw new Error("Unexpected battle action result");
      const next = result.resolution.state;
      if (result.action === "end-turn") awardBattleDodgeXP(draft, before, next);
      commitResolvedBattle(draft, before, next);
      if (result.action === "card") awardCardXP(draft, result.card);
      if (result.action === "wish") discoverCardIds(draft, next.discoveredCardIds);
      return acceptCommand(result.action === "wish" ? next : result.resolution);
    },
    undefined,
    gameSession,
  );
}

export function commitCardPlay(expected: BattleSnapshot, index: number, cardId: string, gameSession: GameSession) {
  return commitBattleInput(expected, { kind: "card", cardId, index, options: PLAYABLE_HAND_OPTIONS }, gameSession);
}

export function commitBattleWish(expected: BattleSnapshot, cardId: string, gameSession: GameSession) {
  return commitBattleInput(expected, { kind: "wish", cardId }, gameSession);
}

export function commitEndTurn(expected: BattleSnapshot, gameSession: GameSession): ResolvedBattleTurn | null {
  return commitBattleInput(expected, { kind: "end-turn" }, gameSession);
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
    playCard: (expected: BattleSnapshot, index: number, cardId: string) =>
      commitCardPlay(expected, index, cardId, gameSession),
    chooseWish: (expected: BattleSnapshot, cardId: string) => commitBattleWish(expected, cardId, gameSession),
    endTurn: (expected: BattleSnapshot) => commitEndTurn(expected, gameSession),
    devVictory: () => commitDevBattleVictory(gameSession),
    clearPresentation: () => clearBattlePresentationUi(gameSession),
    createStartCommands: (onStarted: (result: BattleStarted) => void) =>
      createBattleStartCommands(onStarted, gameSession),
  });
}

export type BattleCapabilities = ReturnType<typeof createBattleCapabilities>;
