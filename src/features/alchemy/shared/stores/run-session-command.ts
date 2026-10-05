import type { CommandOutcome, SynchronousResult } from "./command-outcome";
import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand, subscribeRunSessionCommits } from "./gameplay-command";
import { unwrapReadonlyValue } from "./readonly-view";
import type { RunTransaction } from "./run-transaction";
import { openRunTransaction } from "./transaction-internal";

export { acceptCommand, rejectCommand } from "./command-outcome";
export type { CommandOutcome, SynchronousResult } from "./command-outcome";
export { snapshotReadonlyValue as snapshotTransactionValue } from "./readonly-view";
export { subscribeRunSessionCommits };

export type { RunTransaction } from "./run-transaction";

export function dispatchRunSessionCommand<T>(
  execute: (transaction: RunTransaction) => CommandOutcome<T> & { value: SynchronousResult<T> },
  options?: { afterCommit?: (result: T) => void },
  gameSession: GameSession = defaultGameSession,
): T {
  return dispatchGameplayCommand<T>(
    (draft) => {
      const scope = openRunTransaction(draft);
      try {
        const outcome = execute(scope.transaction);
        return outcome !== null && typeof outcome === "object" && "value" in outcome
          ? { ...outcome, value: unwrapReadonlyValue(outcome.value) }
          : outcome;
      } finally {
        scope.close();
      }
    },
    options,
    gameSession,
  );
}

export function createRunSessionCommand<Args extends unknown[], Ret>(
  mutate: (transaction: RunTransaction, ...args: Args) => CommandOutcome<Ret> & { value: SynchronousResult<Ret> },
  options?: { afterCommit?: (result: Ret) => void },
  gameSession: GameSession = defaultGameSession,
): (...args: Args) => Ret {
  return (...args) =>
    dispatchRunSessionCommand<Ret>((transaction) => mutate(transaction, ...args), options, gameSession);
}
