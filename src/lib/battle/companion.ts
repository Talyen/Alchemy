// Companion turn start processing.
// Depends on: applyCardEffects from apply-effects, types, and constants.
import { applyCardEffects } from "./apply-effects";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data/types";
import { type BattleState, type CombatTextEvent } from "./types";

function buildCompanionCard(
  activeCompanion: NonNullable<BattleState["activeCompanion"]>,
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
  enemyFreezeSkipTurns: number,
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
              (enemyFreezeSkipTurns > 0 ? talentEffects.companionVsFrozenBonus : 0),
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
  );

  // Restore all flags after companion resolution — companion is not a player card play
  // and should not consume per-combat or per-turn bonuses (first-burn-double, etc.).
  // Using a full save/restore avoids the maintenance burden of an allowlist.
  const savedFlags = { ...state.flags };
  const result = applyCardEffects(state, companionCard, combatTexts);
  return { ...result, flags: savedFlags };
}
