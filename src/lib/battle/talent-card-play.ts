import { isPotionCard, getCardKeywords, type BattleCard } from "@/lib/game-data";
import { addPlayerStatusWithCombatText } from "./combat-text";
import { addForgeToPlayer, applyArmorReward, applyCleanseHeals, applyPlayerStatusEffect } from "./status-player";
import { isAttackCard } from "./card-classification";
import { applyDrawResult, drawFromState } from "./draw";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { dealTalentTypedHit } from "./player-typed-hit";
import { reduceEnemyArmor, type BattleState, type CombatTextEvent } from "./types";

function computeTalentAttackBonuses(
  state: BattleState,
  keywords: string[],
  archery: boolean,
  physical: boolean,
  attack: boolean,
): NonNullable<CardEffectResolutionContext["attackBonuses"]> {
  const talents = state.talentEffects;
  return {
    flat: 0,
    physical:
      (archery && state.flags.previousCardWasArchery ? talents.consecutiveArcheryPhysicalDamage : 0) +
      (archery && state.playerStatuses.block === 0 ? talents.archeryPhysicalWithoutBlock : 0) +
      (keywords.includes("poison") && state.enemyStatuses.poison > 0 ? talents.poisonCardPhysicalVsPoisoned : 0),
    bleed: physical && state.flags.previousCardWasNature ? talents.physicalAfterNatureBleedDamage : 0,
    sanguine: attack ? state.flags.sanguinePhysicalBonus : 0,
  };
}

function applyTalentDrawTriggers(state: BattleState, keywords: string[], archery: boolean): BattleState {
  let nextState = state;
  const talents = state.talentEffects;
  if (archery && state.enemyCC.stunSkipTurns > 0 && talents.drawOnArcheryVsStunned > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, talents.drawOnArcheryVsStunned));
  }
  if (keywords.includes("companion") && talents.drawOnCompanionCard > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, talents.drawOnCompanionCard));
  }
  return nextState;
}

function applyTalentStatusAndHitTriggers(
  state: BattleState,
  card: BattleCard,
  keywords: string[],
  nature: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  const talents = state.talentEffects;

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
    nextState = applyPlayerStatusEffect(
      nextState,
      { kind: "player-status", status: "armor", amount: talents.armorOnPotionCard },
      combatTexts,
    );
  }
  if (keywords.includes("burn") && talents.forgeOnBurnCard > 0) {
    nextState = addForgeToPlayer(nextState, talents.forgeOnBurnCard, combatTexts);
  }
  if (keywords.includes("burn") && talents.cleansePoisonOnBurnCard > 0 && nextState.playerStatuses.poison > 0) {
    const poison = Math.max(0, nextState.playerStatuses.poison - talents.cleansePoisonOnBurnCard);
    nextState = { ...nextState, playerStatuses: { ...nextState.playerStatuses, poison } };
    if (poison === 0) nextState = applyCleanseHeals(nextState, combatTexts);
    nextState = dealTalentTypedHit(nextState, "poison", talents.cleansePoisonOnBurnCard, combatTexts);
  }
  if (nature && state.enemyStatuses.poison > 0) {
    nextState = dealTalentTypedHit(nextState, "poison", talents.poisonOnNatureCardVsPoisoned, combatTexts);
  }
  if (nature && talents.thornsOnNatureCard > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", talents.thornsOnNatureCard, combatTexts);
  }
  if (keywords.includes("leech") && talents.armorStealOnLeechCard > 0) {
    const stolen = Math.min(nextState.enemyMitigation.armor, talents.armorStealOnLeechCard);
    if (stolen > 0) {
      nextState = applyArmorReward(reduceEnemyArmor(nextState, stolen), stolen, combatTexts);
    }
  }

  return nextState;
}

export function prepareTalentCardPlay(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  const keywords = getCardKeywords(card);
  const physical = keywords.includes("physical");
  const archery = keywords.includes("archery");
  const nature = keywords.includes("nature");
  const attack = isAttackCard(card);
  const talents = state.talentEffects;

  const attackBonuses = computeTalentAttackBonuses(state, keywords, archery, physical, attack);
  let nextState = applyTalentDrawTriggers(state, keywords, archery);
  nextState = applyTalentStatusAndHitTriggers(nextState, card, keywords, nature, combatTexts);

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
