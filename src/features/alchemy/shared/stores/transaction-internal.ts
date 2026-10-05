import { isDraft, type Immutable } from "immer";
import type { GameplayDraft } from "./gameplay-command";
import type { RunTransaction } from "./run-transaction";
import { createReadonlyView, unwrapReadonlyValue } from "./readonly-view";

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
  if (typeof arg !== "function") return unwrapReadonlyValue(arg);
  const update = arg as (...values: unknown[]) => unknown;
  return (...values: unknown[]) =>
    unwrapReadonlyValue(
      update(...values.map((value) => (value && typeof value === "object" ? createReadonlyView(value) : value))),
    );
}

export function transactionOperation<Args extends unknown[], Result>(
  mutate: (draft: GameplayDraft, ...args: Args) => Result,
): (transaction: RunTransaction, ...args: { [K in keyof Args]: OperationInput<Args[K]> }) => Result {
  return (transaction, ...args) => mutate(transactionDraft(transaction), ...(args.map(operationInput) as Args));
}
