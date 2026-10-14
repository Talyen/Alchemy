import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { rollBattleChance } from "./chance-roll";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { addForgeToPlayer, applyArmorReward, applyBlockReward } from "./status-player";
import { applyDrawResult, drawFromState } from "./draw";
import type { BattleState, CombatTextEvent } from "./types";
import { isPlayerDefeated } from "./battle-outcome";
import { reduceEnemyArmor } from "./enemy-mitigation-state";
import { writeCombatFlag as setFlag } from "./action-context";
import { mergeCombatText } from "./combat-text-events";
import { applyEmergencyWishForEmptyDraw } from "./wish";

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
  keywords: string[],
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  const talents = state.talentEffects;
  const archeryWithoutBlock = keywords.includes("archery") && eligibility.playerStatuses.block === 0;

  if (
    keywords.includes("burn") &&
    talents.forgeOnBurnCard > 0 &&
    (talents.forgeOnBurnCardChance <= 0 || rollBattleChance(talents.forgeOnBurnCardChance, nextState))
  ) {
    nextState = addForgeToPlayer(nextState, talents.forgeOnBurnCard, combatTexts);
  }
  if (
    keywords.includes("block") &&
    talents.armorOnBlockCard > 0 &&
    rollBattleChance(talents.armorOnBlockCardChance, nextState)
  ) {
    nextState = applyArmorReward(nextState, talents.armorOnBlockCard, combatTexts);
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
): BattleState {
  const keywords = getCardKeywords(card);
  const physical = keywords.includes("physical");
  const archery = keywords.includes("archery");
  const talents = state.talentEffects;

  const eligibility = options.eligibility ?? state;
  let nextState = applyTalentDrawTriggers(state, keywords, archery, combatTexts, eligibility);
  if (isPlayerDefeated(nextState)) return nextState;
  nextState = applyTalentStatusAndHitTriggers(nextState, keywords, combatTexts, eligibility);

  if (options.countsAsPlayedCard) {
    const archeryCardsPlayed = state.flags.archeryCardsPlayedThisTurn;
    const secondArcheryCard = archery && archeryCardsPlayed === 1;
    nextState = setFlag(nextState, "archeryCardsPlayedThisTurn", archery ? archeryCardsPlayed + 1 : archeryCardsPlayed);
    nextState = setFlag(nextState, "archerySecondCardActive", secondArcheryCard);
  } else {
    nextState = setFlag(nextState, "archerySecondCardActive", false);
  }

  return {
    ...nextState,
    flags: {
      ...nextState.flags,
      companionNextAttackBonus:
        nextState.flags.companionNextAttackBonus + (physical ? talents.companionNextAttackOnPhysical : 0),
    },
  };
}
