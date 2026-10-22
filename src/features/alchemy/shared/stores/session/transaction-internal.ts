import { isDraft, type Immutable } from "immer";
import { abortGameplayCommand, type GameplayDraft } from "./gameplay-command";
import type { RunTransaction } from "../commands/run-session-command";
import { createReadonlyView, ownTransactionInput } from "./readonly-view";

/** Single generic behind every plain draft-field setter (session, reward flow,
 * run progress, profile). Visit and mystery-visit setters keep bespoke
 * factories in write/run-session.ts: they reshape the activity union rather
 * than setting a field. */
export type FieldUpdate<T> = T | ((previous: T) => T);

function setField<T extends object, K extends keyof T>(target: T, field: K, action: FieldUpdate<T[K]>): void {
  target[field] = typeof action === "function" ? (action as (previous: T[K]) => T[K])(target[field]) : action;
}

export function defineDraftSetter<Target extends object, K extends keyof Target>(
  select: (draft: GameplayDraft) => Target,
  field: K,
) {
  return (draft: GameplayDraft, action: FieldUpdate<Target[K]>): void => {
    setField(select(draft), field, action);
  };
}

const drafts = new WeakMap<object, GameplayDraft>();

export function openRunTransaction(draft: GameplayDraft) {
  const transaction: RunTransaction = createReadonlyView(draft);
  drafts.set(transaction, draft);
  return { transaction, close: () => drafts.delete(transaction) };
}

export function transactionDraft(transaction: RunTransaction): GameplayDraft {
  const draft = drafts.get(transaction);
  if (draft) return draft;
  // Store-owned commands and persistence already operate on the trusted draft.
  if (isDraft(transaction)) return transaction as GameplayDraft;
  throw new Error("Gameplay operations require a current transaction");
}

type OperationInput<T> = T extends (...args: infer Args) => infer Result
  ? (...args: { [K in keyof Args]: Immutable<Args[K]> }) => Result | Immutable<Result>
  : T | Immutable<T>;

function operationInput(arg: unknown): unknown {
  if (typeof arg !== "function") return ownTransactionInput(arg);
  const update = arg as (...values: unknown[]) => unknown;
  return (...values: unknown[]) =>
    ownTransactionInput(
      update(...values.map((value) => (value && typeof value === "object" ? createReadonlyView(value) : value))),
    );
}

/** Operation failures invalidate the enclosing command, even when its caller catches them. */
export function executeTransactionOperation<Result>(
  transaction: RunTransaction,
  execute: (draft: GameplayDraft) => Result,
): Result {
  const draft = transactionDraft(transaction);
  try {
    return execute(draft);
  } catch (error) {
    return abortGameplayCommand(draft, error);
  }
}

export function transactionOperation<Args extends unknown[], Result>(
  mutate: (draft: GameplayDraft, ...args: Args) => Result,
): (transaction: RunTransaction, ...args: { [K in keyof Args]: OperationInput<Args[K]> }) => Result {
  return (transaction, ...args) =>
    executeTransactionOperation(transaction, (draft) => mutate(draft, ...(args.map(operationInput) as Args)));
}
