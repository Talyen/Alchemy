import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { addPlayerStatusWithCombatText } from "./combat-text";
import { addForgeToPlayer, applyPlayerStatusEffect } from "./status-player";
import { isAttackCard } from "./card-classification";
import { applyDrawResult, drawFromState } from "./draw";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { reduceEnemyArmor, type BattleState, type CombatTextEvent } from "./types";

export function prepareTalentCardPlay(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  const keywords = getCardKeywords(card);
  const physical = keywords.includes("physical");
  const archery = keywords.includes("archery");
  const nature = keywords.includes("nature");
  const attack = isAttackCard(card);
  const talents = state.talentEffects;
  const attackBonuses: NonNullable<CardEffectResolutionContext["attackBonuses"]> = {
    flat: 0,
    physical: archery && state.flags.previousCardWasArchery ? talents.consecutiveArcheryPhysicalDamage : 0,
    bleed: physical && state.flags.previousCardWasNature ? talents.physicalAfterNatureBleedDamage : 0,
    sanguine: attack ? state.flags.sanguinePhysicalBonus : 0,
  };
  let nextState = state;
  if (keywords.includes("companion") && talents.drawOnCompanionCard > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, talents.drawOnCompanionCard));
  }
  if (keywords.includes("holy") && talents.blockOnHolyCard > 0) {
    nextState = applyPlayerStatusEffect(
      nextState,
      { kind: "player-status", status: "block", amount: talents.blockOnHolyCard },
      combatTexts,
    );
  }
  if (keywords.includes("burn") && talents.forgeOnBurnCard > 0) {
    nextState = addForgeToPlayer(nextState, talents.forgeOnBurnCard, combatTexts);
  }
  if (keywords.includes("leech") && talents.armorStealOnLeechCard > 0) {
    const stolen = Math.min(state.enemyMitigation.armor, talents.armorStealOnLeechCard);
    if (stolen > 0) {
      nextState = addPlayerStatusWithCombatText(reduceEnemyArmor(nextState, stolen), "armor", stolen, combatTexts, {
        skipFightPacing: true,
      });
    }
  }
  if (nature && talents.thornsOnNatureCard > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", talents.thornsOnNatureCard, combatTexts);
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
