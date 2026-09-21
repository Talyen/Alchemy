import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { BATTLE_CONFIG } from "../game-constants";
import { applyBurnForgePayout, applyLuckyCloverGold, applyNatureManaRefund } from "./bonus-effects";
import { forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageBlock, applyHolyLifesteal, applyHolyTithe } from "./damage-rider-leech";
import { applyDamageStatuses } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import {
  applyBrassCenser,
  applyLifestealAndPlayerHitTriggers,
  applyNatureLeech,
  applyTalentHitConversions,
  resolveFollowUpHit,
  tryPoisonStunProc,
} from "./follow-up-hit-resolution";
import { rollTalentChance } from "./status-helpers";
import { spendPlayerForgeForAttack } from "./status-player";
import { addEnemyStatus, hasEncounterBenefit, type BattleState, type CombatTextEvent } from "./types";
import { applyWishEffect } from "./wish";
import type { CardRecipeRequest } from "./hit-request";
import type { CardHitFacts, HitFacts } from "./hit-facts";

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const nextState = applyBurnForgePayout(state, combatTexts);
  if (rollTalentChance(state.talentEffects.burnStunChance, state)) {
    return resolveFollowUpHit(
      nextState,
      { source: "talent-derived", damageType: "stun", amount: modifiedDamage },
      combatTexts,
    );
  }
  return nextState;
}

export function applyNatureDamageRiders(
  state: BattleState,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { resolvedDamage: modifiedDamage, previousHealth: enemyHealthBeforeHit } = facts;
  if (modifiedDamage <= 0) return state;
  let nextState = applyLuckyCloverGold(state, modifiedDamage, combatTexts);
  nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  if (state.talentEffects.natureLeechChance > 0 || state.gearEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(nextState, modifiedDamage, combatTexts, enemyHealthBeforeHit);
  }
  nextState = applyTalentHitConversions(nextState, "nature", modifiedDamage, combatTexts);
  if (rollTalentChance(state.talentEffects.naturePoisonChance, state)) {
    nextState = addEnemyStatus(nextState, "poison", modifiedDamage);
  }
  if (rollTalentChance(state.talentEffects.natureBleedChance, state)) {
    nextState = addEnemyStatus(nextState, "bleed", modifiedDamage);
  }
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

export function applyHolyDamageRiders(
  state: BattleState,
  card: BattleCard | undefined,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
) {
  const { resolvedDamage: damage, previousHealth: enemyHealthBeforeHit, eligibility } = facts;
  let nextState = applyHolyLifesteal(state, damage, combatTexts, eligibility);
  nextState = applyDamageBlock(nextState, damage, combatTexts, eligibility);
  nextState = applyHolyTithe(nextState, damage, combatTexts);

  nextState = applyTalentHitConversions(nextState, "holy", damage, combatTexts);
  if (rollTalentChance(nextState.talentEffects.holyBurnChance, nextState)) {
    nextState = addEnemyStatus(nextState, "burn", damage);
  }

  if (rollTalentChance(nextState.talentEffects.holyWishChance, nextState)) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts, { kind: "enclosing-action" });
  }

  return applyBrassCenser(nextState, damage, combatTexts, enemyHealthBeforeHit);
}

export function consumeForgeAfterDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  damage: number,
  companionAttack = false,
) {
  if (hasEncounterBenefit(state, "white-heat")) return state;
  if (effect.damageType === "holy" && state.gearEffects.holyPreservesForge > 0) return state;
  const forgeWasApplied = forgeAppliesToDamageType(
    effect.damageType,
    state.talentEffects,
    state.gearEffects,
    companionAttack,
  );

  if (!forgeWasApplied || damage <= 0 || state.playerStatuses.forge <= 0) return state;

  return spendPlayerForgeForAttack(state, BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
}

export function applyCardStatusReactions(
  nextState: BattleState,
  request: CardRecipeRequest,
  facts: CardHitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { effect } = request;
  const { previousHealth, eligibility, resolvedDamage: modifiedDamage } = facts;
  const enemyWasBurningBefore = eligibility.enemyStatuses.burn > 0;
  if (effect.damageType === "physical" || effect.damageType === "bleed") {
    nextState = applyTalentHitConversions(nextState, effect.damageType, modifiedDamage, combatTexts);
  }
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, previousHealth);
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
    nextState = applyBurnDamageRiders(nextState, modifiedDamage, combatTexts);
  }

  return nextState;
}

export function applyCardLeechAndFrozenReactions(
  nextState: BattleState,
  request: CardRecipeRequest,
  facts: CardHitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { effect } = request;
  const { previousHealth, eligibility, resolvedDamage: modifiedDamage } = facts;
  const enemyWasStunned = eligibility.enemyCC.stunSkipTurns > 0;
  const enemyWasFrozen = eligibility.enemyCC.freezeSkipTurns > 0;
  const cardHealing = request.origin === "played-card" || request.origin === "triggered-card";
  const companionAttack = request.origin === "companion";
  if (
    effect.lifesteal ||
    (effect.damageType === "physical" && enemyWasStunned && facts.eligibility.talentEffects.physicalLeechVsStunned)
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

  if (modifiedDamage > 0 && enemyWasFrozen) {
    if (companionAttack)
      nextState = resolveFollowUpHit(
        nextState,
        {
          source: "talent-fixed",
          damageType: "freeze",
          amount: facts.eligibility.talentEffects.companionFreezeDamageVsFrozen,
        },
        combatTexts,
      );
  }
  if (modifiedDamage > 0 && facts.hawkEyeReady) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "holy", amount: facts.eligibility.talentEffects.archeryHolyDamageVsFrozen },
      combatTexts,
    );
  }
  return nextState;
}
