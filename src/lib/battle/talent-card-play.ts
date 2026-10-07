import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { rollBattleChance } from "./chance-roll";
import { isPotionCard, getCardKeywords, type BattleCard } from "@/lib/game-data";
import { addPlayerStatusWithCombatText } from "./player-rewards";
import {
  addForgeToPlayer,
  applyArmorReward,
  applyBlockReward,
  applyCleanseHeals,
  applyPlayerStatusEffect,
} from "./status-player";
import { applyDrawResult, drawFromState } from "./draw";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { isPlayerDefeated, reduceEnemyArmor, setFlag, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text-events";
import { applyEmergencyWishForEmptyDraw } from "./wish";

function computeTalentAttackBonuses(
  state: BattleState,
  keywords: string[],
  archery: boolean,
  physical: boolean,
): NonNullable<CardEffectResolutionContext["attackBonuses"]> {
  const talents = state.talentEffects;
  return {
    flat: 0,
    physical:
      (archery && state.flags.previousCardWasArchery ? talents.consecutiveArcheryPhysicalDamage : 0) +
      (archery && state.playerStatuses.block === 0 ? talents.archeryPhysicalWithoutBlock : 0) +
      (keywords.includes("poison") && state.enemyStatuses.poison > 0 ? talents.poisonCardPhysicalVsPoisoned : 0),
    bleed: physical && state.flags.previousCardWasNature ? talents.physicalAfterNatureBleedDamage : 0,
  };
}

function drawCardPlayReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const drawn = applyDrawResult(state, drawFromState(state, amount), combatTexts);
  const wished = applyEmergencyWishForEmptyDraw(drawn, amount, combatTexts);
  return wished === drawn ? drawn : resolvePendingBattleReactions(wished, combatTexts);
}

function applyTalentDrawTriggers(
  state: BattleState,
  keywords: string[],
  archery: boolean,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  const talents = state.talentEffects;
  if (archery && eligibility.enemyCC.stunSkipTurns > 0 && talents.drawOnArcheryVsStunned > 0) {
    nextState = drawCardPlayReward(nextState, talents.drawOnArcheryVsStunned, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (archery && rollBattleChance(state.gearEffects.archeryDrawChance, state)) {
    nextState = drawCardPlayReward(nextState, 1, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (keywords.includes("companion") && talents.drawOnCompanionCard > 0) {
    nextState = drawCardPlayReward(nextState, talents.drawOnCompanionCard, combatTexts);
  }
  return nextState;
}

function applyTalentStatusAndHitTriggers(
  state: BattleState,
  card: BattleCard,
  keywords: string[],
  nature: boolean,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  const talents = state.talentEffects;
  const archeryWithoutBlock = keywords.includes("archery") && eligibility.playerStatuses.block === 0;

  if (keywords.includes("holy") && talents.wishExtraChoiceAfterHolyCard) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextWishExtraChoice: true } };
  }
  if (keywords.includes("holy") && talents.blockOnHolyCard > 0) {
    nextState = applyPlayerStatusEffect(
      nextState,
      { kind: "player-status", status: "block", amount: talents.blockOnHolyCard },
      combatTexts,
    );
  }
  if (keywords.includes("armor") && talents.blockOnArmorCard > 0) {
    nextState = applyPlayerStatusEffect(
      nextState,
      { kind: "player-status", status: "block", amount: talents.blockOnArmorCard },
      combatTexts,
    );
  }
  if (isPotionCard(card) && talents.armorOnPotionCard > 0) {
    nextState = applyArmorReward(nextState, talents.armorOnPotionCard, combatTexts);
  }
  if (
    keywords.includes("burn") &&
    talents.forgeOnBurnCard > 0 &&
    (talents.forgeOnBurnCardChance <= 0 || rollBattleChance(talents.forgeOnBurnCardChance, nextState))
  ) {
    nextState = addForgeToPlayer(nextState, talents.forgeOnBurnCard, combatTexts);
  }
  if (keywords.includes("burn") && talents.cleansePoisonOnBurnCard > 0 && nextState.playerStatuses.poison > 0) {
    const poison = Math.max(0, nextState.playerStatuses.poison - talents.cleansePoisonOnBurnCard);
    nextState = { ...nextState, playerStatuses: { ...nextState.playerStatuses, poison } };
    if (poison === 0) nextState = applyCleanseHeals(nextState, combatTexts);
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "poison", amount: talents.cleansePoisonOnBurnCard },
      combatTexts,
    );
  }
  if (nature && state.enemyStatuses.poison > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "poison", amount: talents.poisonOnNatureCardVsPoisoned },
      combatTexts,
    );
  }
  if (nature && talents.thornsOnNatureCard > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", talents.thornsOnNatureCard, combatTexts);
  }
  if (keywords.includes("leech") && talents.armorStealOnLeechCard > 0) {
    const stolen = Math.min(nextState.enemyMitigation.armor, talents.armorStealOnLeechCard);
    if (stolen > 0) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "armor", amount: stolen, impact: false });
      nextState = applyArmorReward(reduceEnemyArmor(nextState, stolen), stolen, combatTexts);
    }
  }

  if (archeryWithoutBlock && state.gearEffects.blockOnArcheryWithoutBlock > 0) {
    nextState = applyBlockReward(nextState, state.gearEffects.blockOnArcheryWithoutBlock, combatTexts);
  }

  return nextState;
}

export function prepareTalentCardPlay(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  options: { countsAsPlayedCard?: boolean; eligibility?: BattleState } = {},
) {
  const keywords = getCardKeywords(card);
  const physical = keywords.includes("physical");
  const archery = keywords.includes("archery");
  const nature = keywords.includes("nature");
  const talents = state.talentEffects;

  const attackBonuses = computeTalentAttackBonuses(state, keywords, archery, physical);
  const eligibility = options.eligibility ?? state;
  let nextState = applyTalentDrawTriggers(state, keywords, archery, combatTexts, eligibility);
  if (isPlayerDefeated(nextState)) return { attackBonuses, state: nextState };
  nextState = applyTalentStatusAndHitTriggers(nextState, card, keywords, nature, combatTexts, eligibility);

  if (options.countsAsPlayedCard) {
    const archeryCardsPlayed = state.flags.archeryCardsPlayedThisTurn;
    const secondArcheryCard = archery && archeryCardsPlayed === 1;
    nextState = setFlag(nextState, "archeryCardsPlayedThisTurn", archery ? archeryCardsPlayed + 1 : archeryCardsPlayed);
    nextState = setFlag(nextState, "archerySecondCardActive", secondArcheryCard);
  }

  return {
    attackBonuses,
    state: {
      ...nextState,
      flags: {
        ...nextState.flags,
        previousCardWasArchery: archery,
        previousCardWasNature: nature,
        companionNextAttackBonus:
          nextState.flags.companionNextAttackBonus + (physical ? talents.companionNextAttackOnPhysical : 0),
      },
    },
  };
}
