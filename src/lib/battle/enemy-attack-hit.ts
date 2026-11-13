import { rollBattleChance } from "./chance-roll";
import { readCombatFlag } from "./action-context";
import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR, LABYRINTH_MODIFIER_CONFIG, REACTIVE_REWARD_CHANCES } from "../game-constants";
import type { EnemyAttackEffect } from "@/lib/game-data";
import { processEncounterTraitsForCardCopies } from "./encounter-trait-events";
import { mergeCombatText, emitDamageText } from "./combat-text-events";
import { addGoldWithCombatText, applyHealingWithCombatText } from "./player-rewards";
import { processCompanionTurnStart } from "./companion";
import { purgeOnePlayerBenefit } from "./player-purge";
import { halveRounded } from "./amount-helpers";
import { takeRandomCardFromDeck, drawKeywordCard } from "./draw";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { applyDodgeTalentStatuses } from "./dodge-talent-rewards";
import { applyArmorReward, applyBlockDepletionRewards, applyBlockReward } from "./status-player";
import { resolveCardEffectChain, shouldElementalTalentRepeat } from "./card-play-effects";
import { handlePostPlayCardDestination } from "./card-consume";
import { resolveEnemyDamageEffect, resolvePendingBattleReactions, type EnemyDamageResult } from "./enemy-attack-damage";
import { prepareEnemyDamage, type EnemyDamageOptions } from "./enemy-damage-mitigation";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./encounter-trait-state";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { setPlayerStatus } from "./status-state";

function applyDodgeDrawAndPlay(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.dodgeDrawAndPlay <= 0) return state;
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;

  if (!rollBattleChance(REACTIVE_REWARD_CHANCES.bladedance, state)) return state;
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
  const chained = resolveCardEffectChain(nextState, drawn.card, combatTexts, { playTwice });
  nextState = chained.state;
  nextState = processEncounterTraitsForCardCopies(
    nextState,
    drawn.card,
    combatTexts,
    chained.attackAttempted,
    playTwice ? chained.repeatAttackAttempted : undefined,
  );
  nextState = handlePostPlayCardDestination(nextState, drawn.card, {
    triggerConsumeRiders: !isPlayerDefeated(nextState),
    combatTexts,
  });
  return nextState;
}

function applyDodgeDefensiveReactions(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  const gearBlock = eligibility.playerStatuses.block === 0 ? nextState.gearEffects.blockOnDodge : 0;
  const block = gearBlock + nextState.talentEffects.dodgeBlockAmount;
  if (block > 0) nextState = applyBlockReward(nextState, block, combatTexts);
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
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  if (
    nextState.gearEffects.physicalOnDodge > 0 &&
    nextState.enemyHealth > 0 &&
    rollBattleChance(REACTIVE_REWARD_CHANCES.riposting, nextState)
  ) {
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      resolveFollowUpHit(
        current,
        { source: "player-follow-up", damageType: "physical", amount: current.gearEffects.physicalOnDodge },
        combatTexts,
      ),
    );
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (nextState.gearEffects.bleedOnDodge > 0 && nextState.enemyHealth > 0 && eligibility.enemyStatuses.bleed > 0) {
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      resolveFollowUpHit(
        current,
        { source: "player-follow-up", damageType: "bleed", amount: current.gearEffects.bleedOnDodge },
        combatTexts,
      ),
    );
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (nextState.talentEffects.goldOnDodge > 0 && rollBattleChance(REACTIVE_REWARD_CHANCES.luckyFoot, nextState)) {
    nextState = addGoldWithCombatText(nextState, nextState.talentEffects.goldOnDodge, combatTexts);
  }
  return nextState;
}

function applyDodgeOffensiveBuffs(state: BattleState): BattleState {
  let nextState = state;
  if (state.gearEffects.nextStunAttackBonusOnDodge > 0) {
    nextState = {
      ...nextState,
      flags: {
        ...nextState.flags,
        nextStunAttackBonus: state.gearEffects.nextStunAttackBonusOnDodge,
      },
    };
  }
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
  if (nextState.talentEffects.partingCutDamagePercent > 0) {
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

function applyOnPlayerDodge(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.uniqueGear.viperReady && state.gearEffects.dodgeReadiesVenomousHit > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "notice",
      stat: "poison",
      text: "Viper’s Courtesy Ready",
      signal: "prepared",
    });
  }
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
    emitDamageText(combatTexts, "player", "block", spent, { impact: false });
    nextState = setPlayerStatus(nextState, "block", state.playerStatuses.block - spent);
    nextState = resolvePendingBattleReactions(applyBlockDepletionRewards(state, nextState, combatTexts), combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
    nextState = resolveSecondaryAction(nextState, "retaliation", (current) =>
      resolveFollowUpHit(current, { source: "player-follow-up", damageType: "physical", amount: spent }, combatTexts),
    );
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (state.gearEffects.archeryDodgeAndDraw > 0) nextState = drawKeywordCard(nextState, "archery", { combatTexts });
  nextState = resolvePendingBattleReactions(applyDodgeDefensiveReactions(nextState, combatTexts, state), combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  nextState = resolvePendingBattleReactions(applyDodgeCounterAttacks(nextState, combatTexts, state), combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  nextState = applyDodgeOffensiveBuffs(nextState);
  if (
    nextState.talentEffects.companionAttacksOnDodge &&
    nextState.activeCompanion &&
    nextState.enemyHealth > 0 &&
    rollBattleChance(REACTIVE_REWARD_CHANCES.packWeave, nextState)
  ) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return applyDodgeDrawAndPlay(nextState, combatTexts);
}

function tryDodgeEnemyDamagePacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  canDodge: boolean,
): { state: BattleState; dodged: boolean } {
  const result = tryDodgeEnemyAttackPacket(state, combatTexts, canDodge);
  return result.dodged ? { state: applyOnPlayerDodge(result.state, combatTexts), dodged: true } : result;
}

export function resolveEnemyAttackHit(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions,
): EnemyDamageResult {
  if (getBattleOutcome(state) !== null) return resolveEnemyDamageEffect(state, effect, combatTexts, options);
  const { canDodge = false, ...damageOptions } = options;
  if (canDodge && hasEnemyTrait(state, "ravenous")) effect = { ...effect, lifesteal: true };
  const preparedDamage = prepareEnemyDamage(state, effect, damageOptions);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, canDodge && preparedDamage.attemptedDamage > 0);
  state = dodged.state;
  if (dodged.dodged) {
    const nextState = resolvePendingBattleReactions(state, combatTexts);
    return {
      state: nextState,
      attemptedDamage: preparedDamage.attemptedDamage,
      resolvedDamage: 0,
      healthDamage: 0,
      blockLost: 0,
      healthAfterHit: nextState.playerHealth,
      landed: false,
      dodged: true,
      killed: false,
    };
  }
  const resolved = resolveEnemyDamageEffect(state, effect, combatTexts, {
    ...damageOptions,
    preparedDamage,
    triggerBlockRetaliation: canDodge,
    // Only ability attack packets enter the Dodge window. Bonus hits and
    // periodic pulses must not originate these attack-only room modifiers.
    preDamageBlockStrip:
      canDodge && hasEnemyTrait(state, "sundered-guard") ? LABYRINTH_MODIFIER_CONFIG.attackBlockRemoval : 0,
  });
  const result = {
    ...resolved,
    state:
      canDodge &&
      resolved.landed &&
      getBattleOutcome(resolved.state) === null &&
      hasEnemyTrait(resolved.state, "unbinding-strike")
        ? resolvePendingBattleReactions(purgeOnePlayerBenefit(resolved.state, combatTexts).state, combatTexts)
        : resolved.state,
  };
  const blockDepleted = state.playerStatuses.block > 0 && result.blockLost >= state.playerStatuses.block;
  if (
    blockDepleted &&
    result.state.talentEffects.companionAttackOnBlockDepletedBelowHalf &&
    result.healthAfterHit < state.playerMaxHealth / HALF_DIVISOR &&
    result.state.activeCompanion &&
    getBattleOutcome(result.state) === null
  ) {
    return {
      ...result,
      state: processCompanionTurnStart(result.state, combatTexts),
    };
  }
  return result;
}
