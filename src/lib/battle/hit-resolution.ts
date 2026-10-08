import { rollBattleChance } from "./chance-roll";
import type { BattleCardEffect } from "@/lib/game-data";
import { applyBleedDamageDraw, applyElementalDamageManaRestore, applyHitHealth } from "./player-hit-core";
import type { CardHitRequest, HitFacts, HitRequest } from "./player-hit-core";
import { BLACKFLETCH_EXECUTE_HEALTH_PERCENT, BATTLE_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { halveRounded } from "./amount-helpers";
import { applyHitEpilogue } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { computeReflectedHolyDamageToEnemy, forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageStatuses, applyPoisonTalentRiders } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import { resolveFollowUpHit, tryPoisonStunProc, tryTalentTypedHit } from "./follow-up-hit-resolution";
import { applyCardHitReactions } from "./card-hit-reactions";
import { applyHolyDamageRiders, applyNatureDamageRiders } from "./elemental-hit-reactions";
import { decayArmorAfterDamage } from "./status-helpers";
import { addForgeToPlayer, applyIronGuardReward, spendPlayerForgeForAttack } from "./status-player";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyStatus } from "./status-state";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { applyPurgeGearRewards, purgeEnemyBenefits } from "./enemy-purge";
import { drawKeywordCard } from "./draw";

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
  nextState = applyElementalDamageManaRestore(nextState, "holy", facts.healthDamage, combatTexts);
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
  if (state.gearEffects.attackPurgeOncePerTurn <= 0 || state.uniqueGear.wardbreakerPurgeUsed || state.enemyHealth <= 0)
    return state;
  const purged = purgeEnemyBenefits(state, 1, combatTexts);
  if (purged.removed === 0) return state;
  const marked = { ...purged.state, uniqueGear: { ...purged.state.uniqueGear, wardbreakerPurgeUsed: true } };
  return applyPurgeGearRewards(marked, purged.removed, combatTexts);
}

function consumeForgeAfterDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  damage: number,
  combatTexts: CombatTextEvent[],
  companionAttack = false,
) {
  if (hasEncounterBenefit(state, "white-heat")) return state;
  if (effect.damageType === "holy" && state.gearEffects.holyPreservesForge > 0) return state;
  const forgeWasApplied =
    effect.equalToForge === true ||
    forgeAppliesToDamageType(effect.damageType, state.talentEffects, state.gearEffects, companionAttack);

  if (!forgeWasApplied || damage <= 0 || state.playerStatuses.forge <= 0) return state;

  return spendPlayerForgeForAttack(state, BATTLE_CONFIG.FORGE_DECAY_AMOUNT, combatTexts);
}

function applyCardArcheryReactions(
  nextState: BattleState,
  request: CardHitRequest,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { resolvedDamage } = facts;
  if (request.source !== "card-attack" || !request.card.tags?.includes("archery") || resolvedDamage <= 0) {
    return nextState;
  }
  if (rollBattleChance(nextState.talentEffects.archeryPlayTwiceChance, nextState)) {
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
  const facts = hit.facts;
  const { previousHealth } = facts;
  onDamageDealt?.(facts.healthDamage);
  // Spend the resource used by this packet before its rewards grant fresh Forge.
  let nextState = consumeForgeAfterDamage(hit.state, effect, modifiedDamage, combatTexts, companionAttack);
  nextState = applyIronGuardReward(nextState, effect.damageType, facts.healthDamage, combatTexts);
  if (effect.damageType === "bleed") nextState = applyBleedDamageDraw(nextState, facts.healthDamage, combatTexts);

  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy", combatTexts);

  // Reactions stay depth-first: Archery's extra hit finishes before the outer hit's payout.
  nextState = applyCardHitReactions(nextState, request, facts, combatTexts);
  nextState = applyCardArcheryReactions(nextState, request, facts, combatTexts);
  if (
    facts.critical &&
    modifiedDamage > 0 &&
    card.tags?.includes("archery") &&
    nextState.gearEffects.archeryCritDrawsCompanion > 0
  ) {
    nextState = drawKeywordCard(nextState, "companion", { combatTexts });
  }
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, facts, combatTexts, !companionAttack);
  } else if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, facts, combatTexts, effect.lifesteal === true);
  }

  nextState = applyElementalDamageManaRestore(nextState, effect.damageType, facts.healthDamage, combatTexts);

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "damage",
      stat: effect.damageType,
      amount: modifiedDamage,
      ...(facts.critical ? { critical: true } : {}),
    });
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
