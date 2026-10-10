import { createBattleStartState, drawOpeningHand, type CreateBattleStateOptions } from "./battle-setup";
import { processCompanionTurnStart } from "./companion";
import type { BattleTurnFrame } from "./enemy-turn";
import { getBattleRng } from "@/lib/rng";
import type { BattleResolutionContext, BattleSnapshot, CombatTextEvent } from "./types";
import { battleSnapshot } from "./battle-snapshot";
import { isPlayerDefeated } from "./health-state";
import { applyTurnStartPurge } from "./enemy-purge";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";

export interface ResolvedBattleStart {
  state: BattleSnapshot;
  companion: BattleTurnFrame["companion"];
  outcome: "victory" | "defeat" | null;
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
  const companionId = state.activeCompanion?.id ?? null;
  if (companionId) {
    state = processCompanionTurnStart(state, startingTexts);
    if (state.encounterBenefits.includes("eager-pack")) state = processCompanionTurnStart(state, startingTexts);
  }
  const companion = companionId ? { id: companionId, texts: startingTexts, state: battleSnapshot(state) } : null;
  const opening = drawOpeningHand(state);
  const outcome = isPlayerDefeated(state) ? "defeat" : state.enemyHealth <= 0 ? "victory" : null;
  return { state: battleSnapshot(opening), companion, outcome };
}
