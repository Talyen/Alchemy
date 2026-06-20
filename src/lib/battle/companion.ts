/**
 * Companion turn-start resolution: builds a synthetic 0-cost card from the companion's
 * turnStartEffects and applies it as if played. Depends on: apply-effects, types, game-data.
 * Depended on by: enemy-turn (endPlayerTurn flow).
 */
import { applyCardEffects } from "./apply-effects";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { type BattleState, type CombatTextEvent, applyPlayerHealing, withPreservedFlags } from "./types";
import { HALF_DIVISOR } from "../game-constants";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { computeLeechHeal } from "../game-constants";
import { rollPercent, getBattleRng } from "./status-helpers";

function buildCompanionCard(
  activeCompanion: NonNullable<BattleState["activeCompanion"]>,
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  gearEffects: BattleState["gearEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
  enemyFreezeSkipTurns: number,
  maxMana: number,
  playerForge: number,
  lowHealthMultiplier: number,
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
            amount: Math.round(
              (e.amount +
                companionBondLevel +
                talentEffects.companionDamage +
                gearEffects.companionDamageBonus +
                (e.damageType === "bleed" ? talentEffects.companionBleedDamageBonus : 0) +
                trinketEffects.companionDamageBonus +
                companionDamageBuff +
                (enemyFreezeSkipTurns > 0 ? talentEffects.companionVsFrozenBonus : 0) +
                Math.round((maxMana * talentEffects.companionDamagePerManaCrystal) / HALF_DIVISOR) +
                (gearEffects.companionBenefitsFromForge > 0 && (e.damageType === "physical" || e.damageType === "stun")
                  ? playerForge
                  : 0)) *
                lowHealthMultiplier,
            ),
          }
        : e,
    ),
  };
}

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion || state.enemyHealth <= 0) return state;
  const companionBondLevel = state.talentEffects.companionBondLevels[state.activeCompanion.id];

  const lowHealthMultiplier =
    state.talentEffects.companionDoubledVsLowHealth && state.enemyHealth <= state.enemyMaxHealth * 0.3 ? 2 : 1;

  const companionCard = buildCompanionCard(
    state.activeCompanion,
    state.talentEffects,
    state.trinketEffects,
    state.gearEffects,
    state.companionDamageBuff,
    companionBondLevel,
    state.enemyCC.freezeSkipTurns,
    state.maxMana,
    state.playerStatuses.forge,
    lowHealthMultiplier,
  );

  // Companion actions are not player card plays and should not consume or benefit
  // from per-turn/per-combat one-shot bonuses. withPreservedFlags snapshots the
  // first-time-per-combat flags, sets them to "used" values, runs the effects,
  // then restores the originals — without the manual scope-guard boilerplate.
  return withPreservedFlags(state, (s) => {
    const afterEffects = processEncounterTraitCardAction(
      applyCardEffects(s, companionCard, combatTexts),
      companionCard,
      combatTexts,
    );

    if (state.gearEffects.healOnCompanionAttack > 0) {
      const hasDamageEffect = companionCard.effects.some((e) => e.kind === "damage");
      if (hasDamageEffect) {
        const prevState = afterEffects;
        const healedState = applyPlayerHealing(afterEffects, state.gearEffects.healOnCompanionAttack);
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "heal",
          stat: "health",
          amount: state.gearEffects.healOnCompanionAttack,
        });
        emitOverhealBlockText(prevState, healedState, combatTexts);
        return healedState;
      }
    }

    if (state.talentEffects.companionLeechChance > 0) {
      const hasDamageEffect = companionCard.effects.some((e) => e.kind === "damage");
      if (hasDamageEffect && rollPercent(state.talentEffects.companionLeechChance, getBattleRng(state))) {
        const companionDamage = companionCard.effects
          .filter((e) => e.kind === "damage")
          .reduce((sum, e) => sum + e.amount, 0);
        const leechHeal = computeLeechHeal(companionDamage);
        if (leechHeal > 0) {
          const prevState = afterEffects;
          const healedState = applyPlayerHealing(afterEffects, leechHeal);
          mergeCombatText(combatTexts, {
            target: "player",
            kind: "heal",
            stat: "health",
            amount: leechHeal,
          });
          emitOverhealBlockText(prevState, healedState, combatTexts);
          return healedState;
        }
      }
    }

    return afterEffects;
  });
}
