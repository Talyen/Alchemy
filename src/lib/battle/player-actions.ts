import { getBattleRng } from "@/lib/rng";
import { battleSnapshot } from "./battle-snapshot";
import { playBattleCardResolved, type CardPlayOptions } from "./card-play";
import { chooseWishCard } from "./wish";
import type { BattleResolutionContext, BattleSnapshot, CombatTextEvent } from "./types";

export interface ResolvedPlayerAction {
  state: BattleSnapshot;
  combatTexts: CombatTextEvent[];
}

/** Hosts supply execution capabilities; only combat data crosses back out. */
export function resolveBattleCard(
  snapshot: BattleSnapshot,
  cardId: string,
  index: number,
  context: BattleResolutionContext,
  options?: CardPlayOptions,
): ResolvedPlayerAction {
  const bound = { ...snapshot, rng: getBattleRng(context) };
  const result = playBattleCardResolved(bound, cardId, index, options);
  return {
    state: result.state === bound ? snapshot : battleSnapshot(result.state),
    combatTexts: result.combatTexts,
  };
}

export function resolveBattleWish(
  snapshot: BattleSnapshot,
  cardId: string,
  context: BattleResolutionContext,
): ResolvedPlayerAction {
  const bound = { ...snapshot, rng: getBattleRng(context) };
  const combatTexts: CombatTextEvent[] = [];
  const next = chooseWishCard(bound, cardId, combatTexts);
  return { state: next === bound ? snapshot : battleSnapshot(next), combatTexts };
}
