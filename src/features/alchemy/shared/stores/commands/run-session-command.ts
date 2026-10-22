import type { CommandOutcome, SynchronousResult } from "./command-outcome";
import type { GameSession } from "../session/game-session-types";
import { dispatchGameplayCommand, subscribeRunSessionCommits } from "../session/gameplay-command";
import type { GameplayState } from "../session/gameplay-state-reads";
import { openRunTransaction } from "../session/transaction-internal";
import type { Immutable } from "immer";

export { acceptCommand, rejectCommand } from "./command-outcome";
export type { CommandOutcome, SynchronousResult } from "./command-outcome";
export { snapshotReadonlyValue as snapshotTransactionValue } from "../session/readonly-view";
export { subscribeRunSessionCommits };

export type RunTransaction = Immutable<GameplayState>;

export function dispatchRunSessionCommand<T>(
  execute: (transaction: RunTransaction) => CommandOutcome<T> & { value: SynchronousResult<T> },
  options: { afterCommit?: (result: T) => void } | undefined,
  gameSession: GameSession,
): T {
  return dispatchGameplayCommand<T>(
    (draft) => {
      const scope = openRunTransaction(draft);
      try {
        return execute(scope.transaction);
      } finally {
        scope.close();
      }
    },
    options?.afterCommit ? { afterCommit: options.afterCommit } : undefined,
    gameSession,
  );
}

export function createRunSessionCommand<Args extends unknown[], Ret>(
  mutate: (transaction: RunTransaction, ...args: Args) => CommandOutcome<Ret> & { value: SynchronousResult<Ret> },
  options: { afterCommit?: (result: Ret) => void } | undefined,
  gameSession: GameSession,
): (...args: Args) => Ret {
  return (...args) =>
    dispatchRunSessionCommand<Ret>((transaction) => mutate(transaction, ...args), options, gameSession);
}
