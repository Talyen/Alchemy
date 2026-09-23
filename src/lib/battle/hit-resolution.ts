import { applyHitHealth, type CardHitFacts } from "./hit-facts";
import type { HitRequest, CardHitRequest } from "./hit-request";
import { BLACKFLETCH_EXECUTE_HEALTH_PERCENT, PERCENT_DENOMINATOR } from "../game-constants";
import { halveRounded } from "./amount-helpers";
import { applyHitEpilogue, mergeCombatText } from "./combat-text";
import { computeReflectedHolyDamageToEnemy } from "./damage-calc";
import { applyDamageStatuses, applyPoisonTalentRiders } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import { paceCombatDamage } from "./fight-pacing";
import { applyBrassCenser, resolveFollowUpHit, tryPoisonStunProc, tryTalentTypedHit } from "./follow-up-hit-resolution";
import { decayArmorAfterDamage, getEnemyDamageMultiplier, rollTalentChance } from "./status-helpers";
import { addForgeToPlayer } from "./status-player";
import { addEnemyStatus, type BattleState, type CombatTextEvent } from "./types";
import {
  applyHolyDamageRiders,
  applyNatureDamageRiders,
  consumeForgeAfterDamage,
  applyCardStatusReactions,
  applyCardLeechAndFrozenReactions,
} from "./card-hit-reactions";
import { applyIronGuardReward } from "./status-player";
import { applyBleedDamageDraw } from "./bleed-reactions";

/** Direct player hits have explicit recipes; shallow sources never re-enter card reactions. */
export function resolvePlayerHit(state: BattleState, request: HitRequest, combatTexts: CombatTextEvent[]): BattleState {
  switch (request.source) {
    case "card-attack":
    case "archery-extra":
      return resolveCardHit(state, request, combatTexts);
    case "player-follow-up":
    case "talent-fixed":
    case "talent-derived":
      return resolveFollowUpHit(state, request, combatTexts);
    case "reflected-holy":
      return resolveReflectedHolyHit(state, request.blockLost, combatTexts);
    case "attack-purge":
      return resolveAttackPurgeHit(state, combatTexts);
  }
}

function resolveReflectedHolyHit(state: BattleState, blockLost: number, combatTexts: CombatTextEvent[]): BattleState {
  const { state: mitigated, remainingDamage } = computeReflectedHolyDamageToEnemy(state, blockLost);
  if (remainingDamage <= 0) return mitigated;
  // Capture statuses before damage riders can modify them so status-conditional
  // kill rewards (e.g. healOnBurnEnemyDefeated) evaluate against the pre-hit state,
  // matching the defensive pattern used in applyEnemyDotDamage.
  const preDamageStatuses = mitigated.enemyStatuses;
  const { state: damaged, facts } = applyHitHealth(mitigated, remainingDamage, state);
  let nextState = decayArmorAfterDamage(damaged, remainingDamage, "enemy", combatTexts);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: remainingDamage });
  nextState = applyDamageStatuses(
    nextState,
    { kind: "damage", damageType: "holy", amount: remainingDamage },
    remainingDamage,
    combatTexts,
    facts.previousHealth,
  );
  nextState = applyHolyDamageRiders(nextState, undefined, facts, combatTexts);
  return applyHitEpilogue(nextState, facts.previousHealth, facts.enemyWasAlive, combatTexts, preDamageStatuses);
}

function applyArcheryDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.archeryDetonateBleedPoison <= 0 || state.enemyHealth <= 0) return state;
  if (state.enemyHealth * PERCENT_DENOMINATOR >= state.enemyMaxHealth * BLACKFLETCH_EXECUTE_HEALTH_PERCENT)
    return state;
  return detonateEnemyStatuses(
    state,
    ["bleed", "poison"],
    combatTexts,
    "remaining-ticks",
    (current, damage, texts, healthDamage) => {
      const reacted = applyPoisonTalentRiders(current, healthDamage, texts, true, (next, amount, events) =>
        resolveFollowUpHit(next, { source: "talent-derived", damageType: "bleed", amount }, events),
      );
      return tryPoisonStunProc(reacted, damage, texts);
    },
  );
}

function resolveAttackPurgeHit(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.attackPurgeDealHolyPerEffect <= 0 || state.enemyHealth <= 0) return state;
  const mitigation = state.enemyMitigation;
  const category =
    mitigation.armor > 0 ? "armor" : mitigation.block > 0 ? "block" : mitigation.forge > 0 ? "forge" : null;
  if (!category) return state;
  let nextState: BattleState = {
    ...state,
    enemyMitigation: { ...state.enemyMitigation, [category]: 0 },
  };
  const holyDamage = paceCombatDamage(
    nextState,
    Math.round(nextState.gearEffects.attackPurgeDealHolyPerEffect * getEnemyDamageMultiplier(nextState, "holy")),
    "player",
  );
  if (holyDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: holyDamage });
    const { state: damaged, facts } = applyHitHealth(nextState, holyDamage);
    nextState = applyHitEpilogue(damaged, facts.previousHealth, facts.enemyWasAlive, combatTexts);
    nextState = applyBrassCenser(nextState, holyDamage, combatTexts, facts.previousHealth);
  }
  return nextState;
}

function applyCardArcheryReactions(
  nextState: BattleState,
  request: CardHitRequest,
  facts: CardHitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { resolvedDamage } = facts;
  if (request.source !== "card-attack" || !request.card.tags?.includes("archery") || resolvedDamage <= 0) {
    return nextState;
  }
  if (rollTalentChance(nextState.talentEffects.archeryPlayTwiceChance, nextState)) {
    const secondHit = halveRounded(resolvedDamage);
    if (secondHit > 0) {
      nextState = resolveCardHit(
        nextState,
        { ...request, source: "archery-extra", resolvedDamage: secondHit, critical: false },
        combatTexts,
      );
    }
  }
  nextState = tryTalentTypedHit(
    nextState,
    facts.eligibility.talentEffects.archeryBleedDamageChance,
    "bleed",
    resolvedDamage,
    combatTexts,
  );
  if (rollTalentChance(facts.eligibility.talentEffects.archeryBleedChance, nextState)) {
    nextState = addEnemyStatus(nextState, "bleed", resolvedDamage);
  }
  nextState = applyArcheryDetonate(nextState, combatTexts);
  return nextState;
}

function resolveCardHit(state: BattleState, request: CardHitRequest, combatTexts: CombatTextEvent[]): BattleState {
  const { card, effect, resolvedDamage: modifiedDamage, onDamageDealt } = request;
  const companionAttack = request.origin === "companion";
  const eligibility = state;
  // Eligibility precedes purge, but Health facts describe the target after purge.
  const prePurgeState = request.source === "archery-extra" ? state : resolveAttackPurgeHit(state, combatTexts);
  if (prePurgeState.enemyHealth <= 0) return prePurgeState;
  const hit = applyHitHealth(prePurgeState, modifiedDamage, eligibility, request.critical ?? false);
  const facts: CardHitFacts = { ...hit.facts };
  const { previousHealth } = facts;
  onDamageDealt?.(facts.healthDamage);
  // Spend the resource used by this packet before its rewards grant fresh Forge.
  let nextState = applyIronGuardReward(hit.state, effect.damageType, facts.healthDamage, combatTexts);
  if (effect.damageType === "bleed") nextState = applyBleedDamageDraw(nextState, facts.healthDamage);
  nextState = consumeForgeAfterDamage(nextState, effect, modifiedDamage, companionAttack);

  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy");

  // Reactions stay depth-first: Archery's extra hit finishes before the outer hit's payout.
  nextState = applyCardStatusReactions(nextState, request, facts, combatTexts);
  nextState = applyCardLeechAndFrozenReactions(nextState, request, facts, combatTexts);
  nextState = applyCardArcheryReactions(nextState, request, facts, combatTexts);
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, facts, combatTexts);
  }

  if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, facts, combatTexts);
  }

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  nextState = applyHitEpilogue(nextState, previousHealth, facts.enemyWasAlive, combatTexts);
  if (
    modifiedDamage > 0 &&
    eligibility.enemyCC.freezeSkipTurns > 0 &&
    effect.damageType === "physical" &&
    state.talentEffects.forgeOnPhysicalVsFrozen > 0
  ) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnPhysicalVsFrozen, combatTexts);
  }
  return nextState;
}
