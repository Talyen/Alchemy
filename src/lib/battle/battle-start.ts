import { createBattleStartState, drawOpeningHand, type CreateBattleStateOptions } from "./battle-setup";
import { processCompanionTurnStart } from "./companion";
import type { BattleTurnFrame } from "./enemy-turn";
import { getBattleRng } from "@/lib/rng";
import type { BattleResolutionContext, BattleSnapshot, CombatTextEvent } from "./types";
import { battleSnapshot } from "./battle-snapshot";
import { getBattleOutcome, type BattleOutcome } from "./battle-outcome";
import { applyTurnStartPurge } from "./enemy-purge";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";

export interface ResolvedBattleStart {
  state: BattleSnapshot;
  startingTexts: CombatTextEvent[];
  companion: BattleTurnFrame["companion"];
  outcome: BattleOutcome | null;
}

/** Opening Companions act before the hand is drawn in every battle host. */
export function resolveBattleStart(
  options: Omit<CreateBattleStateOptions, "rng"> & { trackMetrics?: boolean },
  context: BattleResolutionContext,
): ResolvedBattleStart {
  let state = createBattleStartState({ ...options, rng: getBattleRng(context) });
  if (options.trackMetrics) {
    state = { ...state, battleMetrics: { enemyAttackActions: 0, enemyAbilityActivations: {}, enemyAbilityUses: {} } };
  }
  const startingTexts: CombatTextEvent[] = [];
  state = resolvePendingBattleReactions(applyTurnStartPurge(state, startingTexts), startingTexts);
  const companionId = getBattleOutcome(state) === null ? (state.activeCompanion?.id ?? null) : null;
  const companionTexts: CombatTextEvent[] = [];
  if (companionId) {
    state = processCompanionTurnStart(state, companionTexts);
    if (state.encounterBenefits.includes("eager-pack")) state = processCompanionTurnStart(state, companionTexts);
  }
  const companion = companionId ? { id: companionId, texts: companionTexts, state: battleSnapshot(state) } : null;
  const opening = drawOpeningHand(state);
  const outcome = getBattleOutcome(opening);
  return { state: battleSnapshot(opening), startingTexts, companion, outcome };
}
