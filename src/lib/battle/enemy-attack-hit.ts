import type { EnemyAttackEffect } from "@/lib/game-data";
import { prepareTalentCardPlay } from "./talent-card-play";
import {
  mergeCombatText,
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
} from "./combat-text";
import { processCompanionTurnStart } from "./companion";
import { halveRounded } from "./amount-helpers";
import { takeRandomCardFromDeck, drawKeywordCard } from "./draw";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { applyDodgeTalentStatuses } from "./dodge-talent-rewards";
import { applyCardEffects } from "./effect-handlers";
import {
  computeIncomingEnemyAttackDamage,
  resolveEnemyDamageEffect,
  type EnemyDamageOptions,
  type EnemyDamageResult,
} from "./enemy-attack-damage";
import { applyCardPlayTalentRewards, applyMortarAndPestlePotionUse, handlePostPlayCardDestination } from "./card-play";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { hasEnemyTrait, setPlayerStatus, type BattleState, type CombatTextEvent } from "./types";

function applyDodgeDrawAndPlay(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.dodgeDrawAndPlay <= 0) return state;
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;

  const drawn = takeRandomCardFromDeck(state);
  if (!drawn) return state;

  let nextState: BattleState = {
    ...state,
    deck: drawn.deck,
    discard: drawn.discard,
    nextCardUid: drawn.nextCardUid,
  };

  const talentPlay = prepareTalentCardPlay(nextState, drawn.card, combatTexts);
  nextState = talentPlay.state;
  const playContext = {
    attackBonuses: talentPlay.attackBonuses,
    cardHealing: true,
    manaAtStart: nextState.mana,
    enemyFreezeSkipTurnsAtStart: nextState.enemyCC.freezeSkipTurns,
  };

  nextState = applyCardEffects(nextState, drawn.card, combatTexts, playContext);
  nextState = applyMortarAndPestlePotionUse(nextState, drawn.card, combatTexts);
  nextState = applyCardPlayTalentRewards(nextState, drawn.card, combatTexts);
  nextState = handlePostPlayCardDestination(nextState, drawn.card, true, combatTexts);
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
    nextState = dealPlayerTypedHit(nextState, "physical", spent, combatTexts);
  }
  if (state.gearEffects.archeryDodgeAndDraw > 0) nextState = drawKeywordCard(nextState, "archery");
  if (nextState.gearEffects.blockOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", nextState.gearEffects.blockOnDodge, combatTexts);
  }
  if (nextState.talentEffects.blockOnDodgeEqualToAttack && dodgedAmount > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", dodgedAmount, combatTexts);
  }
  const armor = nextState.gearEffects.armorOnDodge + nextState.talentEffects.armorOnDodge;
  if (armor > 0) nextState = addPlayerStatusWithCombatText(nextState, "armor", armor, combatTexts);
  const healing = nextState.gearEffects.healOnDodge + nextState.talentEffects.healOnDodge;
  if (healing > 0) nextState = applyHealingWithCombatText(nextState, healing, combatTexts);
  nextState = applyDodgeTalentStatuses(nextState, combatTexts);
  if (nextState.gearEffects.physicalOnDodge > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "physical", nextState.gearEffects.physicalOnDodge, combatTexts);
  }
  if (nextState.talentEffects.physicalOnDodgeEqualToAttack && dodgedAmount > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "physical", dodgedAmount, combatTexts);
  }
  if (nextState.gearEffects.bleedOnDodge > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "bleed", nextState.gearEffects.bleedOnDodge, combatTexts);
  }
  if (nextState.talentEffects.goldOnDodge > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.talentEffects.goldOnDodge, combatTexts);
  }
  const nextAttackBonus =
    nextState.gearEffects.nextAttackPhysicalOnDodge + nextState.talentEffects.nextAttackPhysicalOnDodge;
  if (nextAttackBonus > 0) {
    nextState = {
      ...nextState,
      flags: {
        ...nextState.flags,
        nextHitPhysicalBonus: nextState.flags.nextHitPhysicalBonus + nextAttackBonus,
      },
    };
  }
  if (nextState.gearEffects.nextAttackCritOnDodge > 0) {
    nextState = {
      ...nextState,
      flags: { ...nextState.flags, nextHitCrit: true },
    };
  }
  if (nextState.talentEffects.partingCutOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextPhysicalDealsBleed: true } };
  }
  if (nextState.talentEffects.nextArcheryCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextArcheryCardFree: true } };
  }
  if (nextState.talentEffects.nextNatureCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextNatureCardFree: true } };
  }
  if (nextState.talentEffects.companionAttacksOnDodge) {
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
  const incomingDamage = computeIncomingEnemyAttackDamage(state, effect, damageOptions);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, canDodge, incomingDamage);
  if (dodged) return { state: dodged, healthDamage: 0, landed: false };
  return resolveEnemyDamageEffect(state, effect, combatTexts, {
    ...damageOptions,
    incomingDamage,
    triggerBlockRetaliation: canDodge,
  });
}
