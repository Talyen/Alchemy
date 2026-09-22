import { readCombatFlag } from "./action-context";
import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR, REACTIVE_REWARD_CHANCES } from "../game-constants";
import { rollTalentChance } from "./status-helpers";
import type { EnemyAttackEffect } from "@/lib/game-data";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { mergeCombatText, addGoldWithCombatText, applyHealingWithCombatText } from "./combat-text";
import { processCompanionTurnStart } from "./companion";
import { halveRounded, scalePercent } from "./amount-helpers";
import { takeRandomCardFromDeck, drawKeywordCard } from "./draw";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { applyDodgeTalentStatuses } from "./dodge-talent-rewards";
import { applyArmorReward, applyBlockDepletionForgeReward, applyBlockReward } from "./status-player";
import {
  applyCardPlayTalentRewards,
  applyMortarAndPestlePotionUse,
  handlePostPlayCardDestination,
  resolveCardEffectChain,
  shouldElementalTalentRepeat,
} from "./card-play";
import { applyCardEffects } from "./effect-handlers";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import {
  prepareEnemyDamage,
  resolveEnemyDamageEffect,
  resolvePendingBattleReactions,
  type EnemyDamageOptions,
  type EnemyDamageResult,
} from "./enemy-attack-damage";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
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

  const playTwice = shouldElementalTalentRepeat(nextState, drawn.card);
  const chained = resolveCardEffectChain(nextState, drawn.card, combatTexts, { skipTalentRewards: playTwice });
  nextState = chained.state;
  const repeatedDamageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
  if (playTwice) {
    nextState = applyCardEffects(nextState, drawn.card, combatTexts, {
      attackBonuses: chained.attackBonuses,
      damageEffects: repeatedDamageEffects,
      origin: "triggered-card",
      manaAtStart: nextState.mana,
      enemyFreezeSkipTurnsAtStart: nextState.enemyCC.freezeSkipTurns,
    });
    nextState = applyMortarAndPestlePotionUse(nextState, drawn.card, combatTexts);
    nextState = applyCardPlayTalentRewards(nextState, drawn.card, combatTexts);
  }
  nextState = processEncounterTraitCardAction(nextState, drawn.card, combatTexts, chained.attackAttempted);
  if (playTwice) {
    nextState = processEncounterTraitCardAction(
      nextState,
      { ...drawn.card, consume: false },
      combatTexts,
      repeatedDamageEffects.length > 0,
      { cardPlayed: false },
    );
  }
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
  const gearBlock = eligibility.playerStatuses.block === 0 ? nextState.gearEffects.blockOnDodge : 0;
  const dodgeBlock =
    nextState.talentEffects.dodgeBlockAmount > 0
      ? nextState.talentEffects.dodgeBlockAmount
      : nextState.talentEffects.blockOnDodgeEqualToAttack
        ? dodgedAmount
        : scalePercent(dodgedAmount, nextState.talentEffects.dodgeBlockPercent);
  if (gearBlock + dodgeBlock > 0) {
    nextState = applyBlockReward(nextState, gearBlock + dodgeBlock, combatTexts, {
      skipFightPacing: dodgeBlock > 0 && nextState.talentEffects.dodgeBlockAmount <= 0,
    });
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
      resolveFollowUpHit(
        current,
        { source: "player-follow-up", damageType: "physical", amount: current.gearEffects.physicalOnDodge },
        combatTexts,
      ),
    );
  }
  const riposteDamage = nextState.talentEffects.physicalOnDodgeEqualToAttack
    ? dodgedAmount
    : scalePercent(dodgedAmount, nextState.talentEffects.dodgePhysicalDamagePercent);
  if (riposteDamage > 0 && nextState.enemyHealth > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-derived", damageType: "physical", amount: riposteDamage },
      combatTexts,
    );
  }
  if (nextState.gearEffects.bleedOnDodge > 0 && nextState.enemyHealth > 0 && eligibility.enemyStatuses.bleed > 0) {
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      resolveFollowUpHit(
        current,
        { source: "player-follow-up", damageType: "bleed", amount: current.gearEffects.bleedOnDodge },
        combatTexts,
      ),
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
  if (nextState.talentEffects.physicalCritOnDodge) {
    nextState = {
      ...nextState,
      flags: { ...nextState.flags, nextPhysicalCrit: true },
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
    nextState = applyBlockDepletionForgeReward(state, nextState, combatTexts);
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      resolveFollowUpHit(current, { source: "player-follow-up", damageType: "physical", amount: spent }, combatTexts),
    );
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (state.gearEffects.archeryDodgeAndDraw > 0) nextState = drawKeywordCard(nextState, "archery");
  nextState = resolvePendingBattleReactions(
    applyDodgeDefensiveReactions(nextState, combatTexts, dodgedAmount, state),
    combatTexts,
  );
  if (isPlayerDefeated(nextState)) return nextState;
  nextState = resolvePendingBattleReactions(
    applyDodgeCounterAttacks(nextState, combatTexts, dodgedAmount, state),
    combatTexts,
  );
  if (isPlayerDefeated(nextState)) return nextState;
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
      blockLost: 0,
      healthAfterHit: state.playerHealth,
      landed: false,
      dodged: true,
      killed: false,
    };
  const result = resolveEnemyDamageEffect(state, effect, combatTexts, {
    ...damageOptions,
    preparedDamage,
    triggerBlockRetaliation: canDodge,
  });
  const blockDepleted = state.playerStatuses.block > 0 && result.blockLost === state.playerStatuses.block;
  if (
    blockDepleted &&
    result.state.talentEffects.companionAttackOnBlockDepletedBelowHalf &&
    result.healthAfterHit < state.playerMaxHealth / HALF_DIVISOR &&
    result.state.activeCompanion &&
    result.state.enemyHealth > 0 &&
    !isPlayerDefeated(result.state)
  ) {
    return {
      ...result,
      state: processCompanionTurnStart(result.state, combatTexts),
    };
  }
  return result;
}
