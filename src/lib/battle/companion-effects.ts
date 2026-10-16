import { rollBattleChance } from "./chance-roll";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import type { BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { applyScaledLeechHealing, computeLeechHeal } from "./damage-rider-leech";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { addForgeToPlayer } from "./status-player";

import { resolveCompanionAction, type CompanionResolutionPort } from "./companion-resolution";

const liveCompanionPort: CompanionResolutionPort = {
  chance: rollBattleChance,
  afterAction: (state, card, texts, attacked) =>
    processEncounterTraitCardAction(state, card, texts, attacked, { cardPlayed: false }),
  forge: addForgeToPlayer,
  heal: applyHealingWithCombatText,
  stun: (state, amount, texts) =>
    resolveFollowUpHit(state, { source: "talent-derived", damageType: "stun", amount }, texts),
  leech: (state, damage, texts) => applyScaledLeechHealing(state, computeLeechHeal(damage), texts),
  mana: gainManaWithCombatText,
  settle: resolvePendingBattleReactions,
};

export function resolveCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  applyEffects: (
    state: BattleState,
    card: BattleCard,
    texts: CombatTextEvent[],
    context?: CardEffectResolutionContext,
  ) => BattleState,
  options?: { damageOnly?: boolean },
) {
  return resolveCompanionAction(state, combatTexts, applyEffects, liveCompanionPort, options);
}
