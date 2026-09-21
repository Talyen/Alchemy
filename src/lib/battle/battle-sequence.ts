import { isPlayerDefeated } from "./types/state-helpers";
import type { BattleState, CombatTextEvent } from "./types/state-types";

export type ReactionBoundary =
  | { kind: "enclosing-action" }
  | { kind: "each-step"; settle: (state: BattleState, texts: CombatTextEvent[]) => BattleState };

/** Ordered, depth-first actions share one rule for settling reactions before the next step. */
export function resolveBattleSequence<T>(
  state: BattleState,
  steps: readonly T[],
  texts: CombatTextEvent[],
  resolve: (state: BattleState, step: T) => BattleState,
  reactions: ReactionBoundary,
  stopWhen: "player-defeated" | "either-defeated" = "player-defeated",
): BattleState {
  let next = state;
  for (const step of steps) {
    if (isPlayerDefeated(next) || (stopWhen === "either-defeated" && next.enemyHealth <= 0)) break;
    next = resolve(next, step);
    if (reactions.kind === "each-step") next = reactions.settle(next, texts);
  }
  return next;
}
