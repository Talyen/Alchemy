import { rollBattleChance } from "./chance-roll";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CardHitRequest, HitFacts } from "./player-hit-core";
import { applyEmberforgedPayout } from "./bonus-effects";
import { applyDamageStatuses } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import {
  applyLifestealAndPlayerHitTriggers,
  applyTalentHitConversions,
  resolveFollowUpHit,
  tryPoisonStunProc,
} from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
  enemyWasBurningBefore: boolean,
  forgeTriggers?: Set<string>,
): BattleState {
  const canAward = !enemyWasBurningBefore && !forgeTriggers?.has("emberforged");
  if (canAward) forgeTriggers?.add("emberforged");
  const nextState = canAward ? applyEmberforgedPayout(state, combatTexts, false) : state;
  if (rollBattleChance(state.talentEffects.burnStunChance, state)) {
    return resolveFollowUpHit(
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
    state.flags.obsidianHammerUsedThisTurn ||
    effect.damageType !== "physical" ||
    state.trinketEffects.forgeStunThreshold <= 0 ||
    forgeBeforeHit < state.trinketEffects.forgeStunThreshold
  )
    return state;

  return resolveFollowUpHit(
    { ...state, flags: { ...state.flags, obsidianHammerUsedThisTurn: true } },
    { source: "talent-fixed", damageType: "stun", amount: state.trinketEffects.forgeStunAmount },
    combatTexts,
  );
}

export function applyCardHitReactions(
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
    cardLeech: request.origin !== "companion",
    eligibility,
    critical: facts.critical,
    forgeBeforeHit: eligibility.playerStatuses.forge,
    forgeTriggers: request.forgeTriggers,
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
  if (effect.damageType === "physical" && modifiedDamage > 0 && nextState.enemyHealth > 0) {
    const stunChance = nextState.talentEffects.physicalStunChance + nextState.gearEffects.physicalStunChance;
    if (rollBattleChance(stunChance, nextState)) {
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
    nextState = applyBurnDamageRiders(
      nextState,
      modifiedDamage,
      combatTexts,
      enemyWasBurningBefore,
      request.forgeTriggers,
    );
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
      effect.damageType === "poison" ? facts.healthDamage : modifiedDamage,
      combatTexts,
      cardHealing && !!effect.lifesteal,
      !companionAttack && !!effect.lifesteal,
    );
  }

  if (
    modifiedDamage > 0 &&
    companionAttack &&
    eligibility.enemyCC.freezeSkipTurns > 0 &&
    eligibility.talentEffects.companionFreezeDamageVsFrozen > 0
  ) {
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
