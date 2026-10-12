import { getBattleRng } from "@/lib/rng";
import type { BattleCard } from "@/lib/game-data";
import { battleSnapshot } from "./battle-snapshot";
import { getBattleOutcome } from "./battle-outcome";
import { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
import { resolveTurnSequence, type ResolvedBattleTurn } from "./enemy-turn";
import { chooseWishCard } from "./wish";
import type { BattleResolutionContext, BattleSnapshot, CombatTextEvent } from "./types";

export interface ResolvedPlayerAction {
  state: BattleSnapshot;
  combatTexts: CombatTextEvent[];
}

export type BattleAction =
  | { kind: "card"; cardId: string; index: number; options?: CardPlayOptions }
  | { kind: "wish"; cardId: string }
  | { kind: "end-turn"; maxTurns?: number };

export type ResolvedBattleAction =
  | { kind: "rejected"; state: BattleSnapshot; reason: string }
  | { kind: "accepted"; action: "card"; card: BattleCard; resolution: ResolvedPlayerAction }
  | { kind: "accepted"; action: "wish"; resolution: ResolvedPlayerAction }
  | { kind: "accepted"; action: "end-turn"; resolution: ResolvedBattleTurn };

/** The engine owns action acceptance for every host, before binding or drawing RNG. */
export function resolveBattleAction(
  snapshot: BattleSnapshot,
  action: BattleAction,
  context: BattleResolutionContext,
): ResolvedBattleAction {
  const reject = (reason: string): ResolvedBattleAction => ({ kind: "rejected", state: snapshot, reason });
  if (snapshot.turnPhase !== "player") return reject("It is not the player's turn");
  if (getBattleOutcome(snapshot) === "defeat") return reject("The player is defeated");

  switch (action.kind) {
    case "card": {
      const card = snapshot.hand[action.index];
      if (
        !Number.isInteger(action.index) ||
        !card ||
        card.id !== action.cardId ||
        !canPlayCard(snapshot, card, action.index, action.options)
      )
        return reject("Card play is unavailable");
      const result = playBattleCardResolved(
        { ...snapshot, rng: getBattleRng(context) },
        card.id,
        action.index,
        action.options,
      );
      return {
        kind: "accepted",
        action: "card",
        card,
        resolution: { state: battleSnapshot(result.state), combatTexts: result.combatTexts },
      };
    }
    case "wish": {
      // Pending choices may finish after an enemy defeat or while controlled.
      // They must settle before the next turn can begin.
      if (!snapshot.wishOptions?.some((card) => card.id === action.cardId)) return reject("Wish choice is unavailable");
      const combatTexts: CombatTextEvent[] = [];
      const state = chooseWishCard({ ...snapshot, rng: getBattleRng(context) }, action.cardId, combatTexts);
      return { kind: "accepted", action: "wish", resolution: { state: battleSnapshot(state), combatTexts } };
    }
    case "end-turn": {
      if (snapshot.wishOptions || getBattleOutcome(snapshot) !== null) return reject("Turn completion is unavailable");
      if (action.maxTurns !== undefined && (!Number.isInteger(action.maxTurns) || action.maxTurns <= 0))
        return reject("Turn budget must be a positive integer");
      return {
        kind: "accepted",
        action: "end-turn",
        resolution: resolveTurnSequence(
          snapshot,
          { ...context, rng: getBattleRng(context) },
          action.maxTurns === undefined ? undefined : { maxTurns: action.maxTurns },
        ),
      };
    }
  }
}

// Convenience APIs retain their data-only result shapes; acceptance has one owner.
export function resolveBattleCard(
  snapshot: BattleSnapshot,
  cardId: string,
  index: number,
  context: BattleResolutionContext,
  options?: CardPlayOptions,
): ResolvedPlayerAction {
  const result = resolveBattleAction(snapshot, { kind: "card", cardId, index, options }, context);
  return result.kind === "accepted" && result.action === "card"
    ? result.resolution
    : { state: snapshot, combatTexts: [] };
}

export function resolveBattleWish(
  snapshot: BattleSnapshot,
  cardId: string,
  context: BattleResolutionContext,
): ResolvedPlayerAction {
  const result = resolveBattleAction(snapshot, { kind: "wish", cardId }, context);
  return result.kind === "accepted" && result.action === "wish"
    ? result.resolution
    : { state: snapshot, combatTexts: [] };
}

export function resolveBattleTurn(
  snapshot: BattleSnapshot,
  context: BattleResolutionContext,
  options?: { maxTurns: number },
): ResolvedBattleTurn {
  const result = resolveBattleAction(snapshot, { kind: "end-turn", maxTurns: options?.maxTurns }, context);
  return result.kind === "accepted" && result.action === "end-turn"
    ? result.resolution
    : { state: snapshot, frames: [] };
}
