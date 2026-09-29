import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { applyBleedDamageDraw, applyElementalDamageManaRestore, applyHitHealth } from "./player-hit-core";
import type { CardHitRequest, HitFacts, HitRequest } from "./player-hit-core";
import { BLACKFLETCH_EXECUTE_HEALTH_PERCENT, BATTLE_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { halveRounded } from "./amount-helpers";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, applyHitEpilogue } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { computeReflectedHolyDamageToEnemy, forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageStatuses, applyPoisonTalentRiders } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import {
  applyBrassCenser,
  applyLifestealAndPlayerHitTriggers,
  applyNatureLeech,
  applyTalentHitConversions,
  resolveFollowUpHit,
  tryPoisonStunProc,
  tryTalentTypedHit,
} from "./follow-up-hit-resolution";
import {
  applyBurnForgePayout,
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
} from "./bonus-effects";
import { applyDamageBlock, applyHolyBlockChance, applyHolyLifesteal, applyHolyTithe } from "./damage-rider-leech";
import { decayArmorAfterDamage, rollTalentChance } from "./status-helpers";
import {
  addForgeToPlayer,
  applyArmorReward,
  applyBlockReward,
  applyIronGuardReward,
  spendPlayerForgeForAttack,
} from "./status-player";
import { addEnemyStatus, hasEncounterBenefit, type BattleState, type CombatTextEvent } from "./types";
import { applyPurgeGearRewards, purgeEnemyBenefits } from "./enemy-purge";
import { applyWishEffect } from "./wish";
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

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
  enemyWasBurningBefore: boolean,
): BattleState {
  const nextState = applyBurnForgePayout(state, combatTexts, enemyWasBurningBefore);
  if (rollTalentChance(state.talentEffects.burnStunChance, state)) {
    return resolveFollowUpHit(
      nextState,
      { source: "talent-derived", damageType: "stun", amount: modifiedDamage },
      combatTexts,
    );
  }
  return nextState;
}

function applyNatureDamageRiders(
  state: BattleState,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
  alreadyLeeches = false,
): BattleState {
  const { resolvedDamage: modifiedDamage, previousHealth: enemyHealthBeforeHit } = facts;
  if (modifiedDamage <= 0) return state;
  let nextState = applyLuckyCloverGold(state, modifiedDamage, combatTexts);
  nextState = applyNatureGoldReward(nextState, facts.healthDamage, combatTexts);
  nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  if (rollTalentChance(state.talentEffects.armorOnNatureDamageChance, state)) {
    nextState = applyArmorReward(nextState, modifiedDamage, combatTexts);
  }
  if (rollTalentChance(state.talentEffects.thornsOnNatureDamageChance, state)) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", modifiedDamage, combatTexts);
  }
  if (rollTalentChance(state.talentEffects.healOnNatureDamageChance, state)) {
    nextState = applyHealingWithCombatText(nextState, modifiedDamage, combatTexts);
  }
  const guaranteedLeech =
    !alreadyLeeches && state.gearEffects.natureLeechVsPoisoned > 0 && facts.eligibility.enemyStatuses.poison > 0;
  if (guaranteedLeech || state.talentEffects.natureLeechChance > 0 || state.gearEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(
      nextState,
      guaranteedLeech ? facts.healthDamage : modifiedDamage,
      combatTexts,
      enemyHealthBeforeHit,
      guaranteedLeech,
    );
  }
  nextState = applyTalentHitConversions(nextState, "nature", modifiedDamage, combatTexts);
  if (rollTalentChance(state.talentEffects.natureStunChance, state)) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-derived", damageType: "stun", amount: modifiedDamage },
      combatTexts,
    );
  }
  return nextState;
}

function applyForgeStunRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
  forgeBeforeHit: number,
) {
  if (
    effect.damageType !== "physical" ||
    state.trinketEffects.forgeStunThreshold <= 0 ||
    forgeBeforeHit < state.trinketEffects.forgeStunThreshold
  )
    return state;

  return resolveFollowUpHit(
    state,
    { source: "player-follow-up", damageType: "stun", amount: state.trinketEffects.forgeStunAmount },
    combatTexts,
  );
}

function applyHolyDamageRiders(
  state: BattleState,
  card: BattleCard | undefined,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
  heroAttack = true,
) {
  const { resolvedDamage: damage, previousHealth: enemyHealthBeforeHit, eligibility } = facts;
  if (damage <= 0) return state;
  let nextState = applyHolyLifesteal(state, damage, combatTexts, eligibility);
  if (
    heroAttack &&
    card &&
    facts.healthDamage > 0 &&
    eligibility.playerStatuses.block === 0 &&
    state.gearEffects.blockOnHolyHitWithoutBlock > 0
  ) {
    nextState = applyBlockReward(nextState, state.gearEffects.blockOnHolyHitWithoutBlock, combatTexts);
  }
  nextState = applyHolyBlockChance(nextState, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts, eligibility);
  nextState = applyHolyTithe(nextState, damage, combatTexts);

  nextState = applyTalentHitConversions(nextState, "holy", damage, combatTexts);

  if (rollTalentChance(nextState.talentEffects.holyWishChance, nextState)) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts, { kind: "enclosing-action" });
  }

  return applyBrassCenser(nextState, damage, combatTexts, enemyHealthBeforeHit);
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

function applyCardHitReactions(
  nextState: BattleState,
  request: CardHitRequest,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { effect } = request;
  const { previousHealth, eligibility, resolvedDamage: modifiedDamage } = facts;
  const enemyWasBurningBefore = eligibility.enemyStatuses.burn > 0;
  if (effect.damageType === "physical" || effect.damageType === "bleed") {
    nextState = applyTalentHitConversions(nextState, effect.damageType, modifiedDamage, combatTexts);
  }
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, previousHealth, {
    critical: facts.critical,
    forgeBeforeHit: eligibility.playerStatuses.forge,
    onPoisonBleedConversion: (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
  });
  if (effect.detonateAllBurn || (effect.detonateIfEnemyBurning && enemyWasBurningBefore)) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  if (effect.detonateAllBleed) {
    nextState = detonateEnemyStatuses(nextState, ["bleed"], combatTexts);
  }
  if (modifiedDamage > 0)
    nextState = applyForgeStunRider(nextState, effect, combatTexts, facts.eligibility.playerStatuses.forge);
  if (effect.damageType === "physical" && modifiedDamage > 0) {
    const stunChance = nextState.talentEffects.physicalStunChance + nextState.gearEffects.physicalStunChance;
    if (rollTalentChance(stunChance, nextState)) {
      nextState = resolveFollowUpHit(
        nextState,
        { source: "talent-derived", damageType: "stun", amount: modifiedDamage },
        combatTexts,
      );
    }
  }
  if (effect.damageType === "poison") {
    nextState = tryPoisonStunProc(nextState, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "burn" && modifiedDamage > 0) {
    nextState = applyBurnDamageRiders(nextState, modifiedDamage, combatTexts, enemyWasBurningBefore);
  }

  const enemyWasStunned = eligibility.enemyCC.stunSkipTurns > 0;
  const cardHealing = request.origin === "played-card" || request.origin === "triggered-card";
  const companionAttack = request.origin === "companion";
  if (
    effect.lifesteal ||
    (effect.damageType === "physical" && enemyWasStunned && facts.eligibility.talentEffects.physicalLeechVsStunned) ||
    (effect.damageType === "physical" &&
      !companionAttack &&
      eligibility.playerHealth < eligibility.playerMaxHealth / 2 &&
      eligibility.gearEffects.physicalLeechBelowHalfHealth > 0)
  ) {
    nextState = applyLifestealAndPlayerHitTriggers(
      nextState,
      modifiedDamage,
      combatTexts,
      cardHealing && !!effect.lifesteal,
      !companionAttack && !!effect.lifesteal,
      previousHealth,
    );
  }

  if (modifiedDamage > 0 && companionAttack && eligibility.enemyCC.freezeSkipTurns > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      {
        source: "talent-fixed",
        damageType: "freeze",
        amount: eligibility.talentEffects.companionFreezeDamageVsFrozen,
      },
      combatTexts,
    );
  }

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
  let nextState = applyIronGuardReward(hit.state, effect.damageType, facts.healthDamage, combatTexts);
  if (effect.damageType === "bleed") nextState = applyBleedDamageDraw(nextState, facts.healthDamage);
  nextState = consumeForgeAfterDamage(nextState, effect, modifiedDamage, combatTexts, companionAttack);

  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy");

  // Reactions stay depth-first: Archery's extra hit finishes before the outer hit's payout.
  nextState = applyCardHitReactions(nextState, request, facts, combatTexts);
  nextState = applyCardArcheryReactions(nextState, request, facts, combatTexts);
  if (
    facts.critical &&
    modifiedDamage > 0 &&
    card.tags?.includes("archery") &&
    nextState.gearEffects.archeryCritDrawsCompanion > 0
  ) {
    nextState = drawKeywordCard(nextState, "companion");
  }
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, facts, combatTexts, !companionAttack);
  } else if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, facts, combatTexts, effect.lifesteal === true);
  }

  nextState = applyElementalDamageManaRestore(nextState, effect.damageType, facts.healthDamage, combatTexts);

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
