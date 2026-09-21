import { readCombatFlag } from "./action-context";
import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR, REACTIVE_REWARD_CHANCES } from "../game-constants";
import { rollTalentChance } from "./status-helpers";
import type { EnemyAttackEffect } from "@/lib/game-data";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import {
  mergeCombatText,
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
} from "./combat-text";
import { processCompanionTurnStart } from "./companion";
import { halveRounded, scalePercent } from "./amount-helpers";
import { takeRandomCardFromDeck, drawKeywordCard } from "./draw";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { applyDodgeTalentStatuses } from "./dodge-talent-rewards";
import { applyArmorReward } from "./status-player";
import { handlePostPlayCardDestination, resolveCardEffectChain } from "./card-play";
import {
  prepareEnemyDamage,
  resolveEnemyDamageEffect,
  resolvePendingBattleReactions,
  type EnemyDamageOptions,
  type EnemyDamageResult,
} from "./enemy-attack-damage";
import { dealPlayerTypedHit, dealTalentTypedHit } from "./player-typed-hit";
import { hasEnemyTrait, isPlayerDefeated, setPlayerStatus, type BattleState, type CombatTextEvent } from "./types";

function applyDodgeDrawAndPlay(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.dodgeDrawAndPlay <= 0) return state;
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;

  if (!rollTalentChance(REACTIVE_REWARD_CHANCES.bladedance, state)) return state;
  const drawn = takeRandomCardFromDeck(state);
  if (!drawn) return state;

  let nextState: BattleState = {
    ...state,
    deck: drawn.deck,
    discard: drawn.discard,
    nextCardUid: drawn.nextCardUid,
    uniqueGear: drawn.uniqueGear,
  };

  const chained = resolveCardEffectChain(nextState, drawn.card, combatTexts);
  nextState = chained.state;
  nextState = processEncounterTraitCardAction(nextState, drawn.card, combatTexts, chained.attackAttempted);
  nextState = handlePostPlayCardDestination(nextState, drawn.card, !isPlayerDefeated(nextState), combatTexts);
  return nextState;
}

function applyDodgeDefensiveReactions(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  dodgedAmount: number,
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  if (eligibility.playerStatuses.block === 0 && nextState.gearEffects.blockOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", nextState.gearEffects.blockOnDodge, combatTexts);
  }
  const dodgeBlock = nextState.talentEffects.blockOnDodgeEqualToAttack
    ? dodgedAmount
    : scalePercent(dodgedAmount, nextState.talentEffects.dodgeBlockPercent);
  if (dodgeBlock > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", dodgeBlock, combatTexts, { skipFightPacing: true });
  }
  const armor = nextState.gearEffects.armorOnDodge + nextState.talentEffects.armorOnDodge;
  if (eligibility.playerStatuses.armor === 0 && armor > 0) nextState = applyArmorReward(nextState, armor, combatTexts);
  const healing =
    (eligibility.playerHealth < eligibility.playerMaxHealth / HALF_DIVISOR ? state.gearEffects.healOnDodge : 0) +
    state.talentEffects.healOnDodge;
  if (healing > 0) nextState = applyHealingWithCombatText(nextState, healing, combatTexts);
  return applyDodgeTalentStatuses(nextState, combatTexts);
}

function applyDodgeCounterAttacks(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  dodgedAmount: number,
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  if (
    nextState.gearEffects.physicalOnDodge > 0 &&
    nextState.enemyHealth > 0 &&
    rollTalentChance(REACTIVE_REWARD_CHANCES.riposting, nextState)
  ) {
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      dealPlayerTypedHit(current, "physical", current.gearEffects.physicalOnDodge, combatTexts),
    );
  }
  const riposteDamage = nextState.talentEffects.physicalOnDodgeEqualToAttack
    ? dodgedAmount
    : scalePercent(dodgedAmount, nextState.talentEffects.dodgePhysicalDamagePercent);
  if (riposteDamage > 0 && nextState.enemyHealth > 0) {
    nextState = dealTalentTypedHit(nextState, "physical", riposteDamage, combatTexts, true);
  }
  if (nextState.gearEffects.bleedOnDodge > 0 && nextState.enemyHealth > 0 && eligibility.enemyStatuses.bleed > 0) {
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      dealPlayerTypedHit(current, "bleed", current.gearEffects.bleedOnDodge, combatTexts),
    );
  }
  if (nextState.talentEffects.goldOnDodge > 0 && rollTalentChance(REACTIVE_REWARD_CHANCES.luckyFoot, nextState)) {
    nextState = addGoldWithCombatText(nextState, nextState.talentEffects.goldOnDodge, combatTexts);
  }
  return nextState;
}

function applyDodgeOffensiveBuffs(state: BattleState): BattleState {
  let nextState = state;
  const nextAttackBonus =
    nextState.gearEffects.nextAttackPhysicalOnDodge + nextState.talentEffects.nextAttackPhysicalOnDodge;
  if (nextAttackBonus > 0) {
    nextState = {
      ...nextState,
      flags: {
        ...nextState.flags,
        nextHitPhysicalBonus: readCombatFlag(nextState, "nextHitPhysicalBonus") + nextAttackBonus,
      },
    };
  }
  if (nextState.gearEffects.nextAttackCritOnDodge > 0) {
    nextState = {
      ...nextState,
      flags: { ...nextState.flags, nextHitCrit: true },
    };
  }
  if (nextState.talentEffects.partingCutOnDodge || nextState.talentEffects.partingCutDamagePercent > 0) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextPhysicalDealsBleed: true } };
  }
  if (nextState.talentEffects.nextArcheryCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextArcheryCardFree: true } };
  }
  if (nextState.talentEffects.nextNatureCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextNatureCardFree: true } };
  }
  return nextState;
}

function applyOnPlayerDodge(state: BattleState, combatTexts: CombatTextEvent[], dodgedAmount: number): BattleState {
  let nextState = {
    ...state,
    uniqueGear: {
      ...state.uniqueGear,
      viperReady: state.uniqueGear.viperReady || state.gearEffects.dodgeReadiesVenomousHit > 0,
      wildheartReady: state.uniqueGear.wildheartReady || state.gearEffects.dodgeReadiesNatureCrit > 0,
    },
  };
  if (state.gearEffects.dodgeSpendsPreservedBlock > 0 && state.playerStatuses.block > 0) {
    const spent = halveRounded(state.playerStatuses.block);
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: spent });
    nextState = setPlayerStatus(nextState, "block", state.playerStatuses.block - spent);
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      dealPlayerTypedHit(current, "physical", spent, combatTexts),
    );
  }
  if (state.gearEffects.archeryDodgeAndDraw > 0) nextState = drawKeywordCard(nextState, "archery");
  nextState = applyDodgeDefensiveReactions(nextState, combatTexts, dodgedAmount, state);
  nextState = applyDodgeCounterAttacks(nextState, combatTexts, dodgedAmount, state);
  nextState = applyDodgeOffensiveBuffs(nextState);
  if (
    nextState.talentEffects.companionAttacksOnDodge &&
    nextState.activeCompanion &&
    nextState.enemyHealth > 0 &&
    rollTalentChance(REACTIVE_REWARD_CHANCES.packWeave, nextState)
  ) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return applyDodgeDrawAndPlay(nextState, combatTexts);
}

function tryDodgeEnemyDamagePacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  canDodge: boolean,
  dodgedAmount: number,
): BattleState | null {
  const dodged = tryDodgeEnemyAttackPacket(state, combatTexts, canDodge);
  if (!dodged) return null;
  return applyOnPlayerDodge(dodged, combatTexts, dodgedAmount);
}

export interface AttackDamageOptions extends EnemyDamageOptions {
  canDodge: boolean;
}

export function resolveEnemyAttackHit(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: AttackDamageOptions,
): EnemyDamageResult {
  const { canDodge, ...damageOptions } = options;
  if (canDodge && hasEnemyTrait(state, "ravenous")) effect = { ...effect, lifesteal: true };
  const preparedDamage = prepareEnemyDamage(state, effect, damageOptions);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, canDodge, preparedDamage.incomingDamage);
  if (dodged)
    return {
      state: resolvePendingBattleReactions(dodged, combatTexts),
      attemptedDamage: preparedDamage.attemptedDamage,
      resolvedDamage: 0,
      healthDamage: 0,
      landed: false,
      dodged: true,
      killed: false,
    };
  return resolveEnemyDamageEffect(state, effect, combatTexts, {
    ...damageOptions,
    preparedDamage,
    triggerBlockRetaliation: canDodge,
  });
}
