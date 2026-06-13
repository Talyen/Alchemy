/**
 * Companion turn-start resolution: builds a synthetic 0-cost card from the companion's
 * turnStartEffects and applies it as if played. Depends on: apply-effects, types, game-data.
 * Depended on by: enemy-turn (endPlayerTurn flow).
 */
import { applyCardEffects } from "./apply-effects";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { type BattleState, type CombatTextEvent } from "./types";
import { HALF_DIVISOR } from "../game-constants";
import { processEncounterTraitCardAction } from "./encounter-trait-events";

function buildCompanionCard(
  activeCompanion: NonNullable<BattleState["activeCompanion"]>,
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
  enemyFreezeSkipTurns: number,
  maxMana: number,
): BattleCard {
  return {
    id: `companion-${activeCompanion.id}`,
    title: activeCompanion.title,
    descriptionLines: [],
    art: activeCompanion.art,
    cost: 0,
    effects: activeCompanion.turnStartEffects.map((e) =>
      e.kind === "damage"
        ? {
            ...e,
            amount:
              e.amount +
              companionBondLevel +
              talentEffects.companionDamage +
              (e.damageType === "bleed" ? talentEffects.companionBleedDamageBonus : 0) +
              trinketEffects.companionDamageBonus +
              companionDamageBuff +
              (enemyFreezeSkipTurns > 0 ? talentEffects.companionVsFrozenBonus : 0) +
              Math.round((maxMana * talentEffects.companionDamagePerManaCrystal) / HALF_DIVISOR),
          }
        : e,
    ),
  };
}

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion || state.enemyHealth <= 0) return state;
  const companionBondLevel = state.talentEffects.companionBondLevels[state.activeCompanion.id] ?? 0;

  const companionCard = buildCompanionCard(
    state.activeCompanion,
    state.talentEffects,
    state.trinketEffects,
    state.companionDamageBuff,
    companionBondLevel,
    state.enemyFreezeSkipTurns,
    state.maxMana,
  );

  // Snapshot flags before companion effects and restore them after — companion actions
  // are not player card plays and should not consume or benefit from per-turn/per-combat
  // one-shot bonuses (first-burn-double, first-free-card, etc.).
  const originalCardPlayFlags = {
    firstPhysicalCardFreeUsed: state.flags.firstPhysicalCardFreeUsed,
    firstHolyCardFreeUsed: state.flags.firstHolyCardFreeUsed,
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstArmorCardDoubledUsed: state.flags.firstArmorCardDoubledUsed,
    firstPoisonCardFreeUsed: state.flags.firstPoisonCardFreeUsed,
    firstBleedCardFreeUsed: state.flags.firstBleedCardFreeUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstLeechCardDoubledUsed: state.flags.firstLeechCardDoubledUsed,
    firstPotionFreeUsed: state.flags.firstPotionFreeUsed,
    nextCardCostReduction: state.flags.nextCardCostReduction,
    resonantChimeUsedThisTurn: state.flags.resonantChimeUsedThisTurn,
    runicQuillUsedThisTurn: state.flags.runicQuillUsedThisTurn,
  };

  const tempState: BattleState = {
    ...state,
    flags: {
      ...state.flags,
      firstPhysicalCardFreeUsed: true,
      firstHolyCardFreeUsed: true,
      firstBurnCardDoubledUsed: true,
      firstArmorCardDoubledUsed: true,
      firstPoisonCardFreeUsed: true,
      firstBleedCardFreeUsed: true,
      firstHolyDamageBonusUsed: true,
      firstBurnTrinketDoubledUsed: true,
      firstLeechCardDoubledUsed: true,
      firstPotionFreeUsed: true,
      nextCardCostReduction: 0,
      resonantChimeUsedThisTurn: true,
      runicQuillUsedThisTurn: true,
    },
  };

  const result = processEncounterTraitCardAction(
    applyCardEffects(tempState, companionCard, combatTexts),
    companionCard,
    combatTexts,
  );

  return {
    ...result,
    flags: {
      ...result.flags,
      ...originalCardPlayFlags,
    },
  };
}
