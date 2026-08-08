// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Each command opens one Immer produce over the committed root, runs its body
// against one explicit draft (slice actions mutate it in place), and publishes
// exactly one revision on success. A thrown body discards the draft and skips
// `afterCommit` effects.
import { isDraft, produce } from "immer";
import type { Draft } from "immer";
import {
  applyGameplayStateUpdate,
  subscribeGameplayCommits,
  useGameplayStateStore,
  type GameplayState,
} from "./gameplay-state-store";

export type GameplayDraft = Draft<GameplayState>;

export function isGameplayDraft(value: unknown): value is GameplayDraft {
  return isDraft(value);
}

/** Bind an aggregate action without opening a nested command. */
export function bindDraftAction<Args extends unknown[], Ret>(
  select: (state: GameplayDraft) => (...args: Args) => Ret,
): {
  (draft: GameplayDraft, ...args: Args): Ret;
  (...args: Args): Ret;
} {
  const bound = ((...args: unknown[]) => {
    const [first, ...rest] = args;
    if (isGameplayDraft(first)) return select(first)(...(rest as Args));
    return dispatchRunSessionCommand((draft) => select(draft)(...(args as Args)));
  }) as {
    (draft: GameplayDraft, ...args: Args): Ret;
    (...args: Args): Ret;
    draftFirst?: true;
  };
  bound.draftFirst = true;
  return bound;
}

export function invokeDraftAction<Args extends unknown[], Ret>(
  action: (...args: Args) => Ret,
  draft: GameplayDraft,
  ...args: Args
): Ret {
  if ((action as typeof action & { draftFirst?: true }).draftFirst) {
    return (action as unknown as (draft: GameplayDraft, ...args: Args) => Ret)(draft, ...args);
  }
  return action(...args);
}

/**
 * Execute one synchronous gameplay command and publish one committed revision.
 * The recipe runs against one Immer draft. A thrown recipe discards that draft;
 * successful recipes publish one revision before `afterCommit` effects run.
 */
export function dispatchRunSessionCommand<T>(
  execute: (draft: GameplayDraft) => T,
  options?: { afterCommit?: (result: T) => void },
): T {
  let result!: T;
  const base = useGameplayStateStore.getState();
  const next = produce(base, (draft: GameplayDraft) => {
    result = execute(draft);
  });

  if (next !== base) applyGameplayStateUpdate(next, true);
  options?.afterCommit?.(result);
  return result;
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}

export function getRunSessionRevision(): number {
  return useGameplayStateStore.getState().revision;
}
