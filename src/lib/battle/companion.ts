/**
 * Companion turn-start resolution: builds a synthetic 0-cost card from the companion's
 * turnStartEffects and applies it as if played. Depends on: effect-handlers, types, game-data.
 * Depended on by: battle start and post-draw companion follow-up (player turn start).
 */
import { applyCardEffects } from "./effect-handlers";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { type BattleState, type CombatTextEvent, withPreservedFlags } from "./types";
import { HALF_DIVISOR } from "../game-constants";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { applyHealingWithCombatText } from "./combat-text";
import { computeLeechHeal } from "../game-constants";
import { rollPercent, getBattleRng } from "./status-helpers";

function companionDamageBonusForEffect(
  effect: Extract<BattleCard["effects"][number], { kind: "damage" }>,
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  gearEffects: BattleState["gearEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
  enemyFreezeSkipTurns: number,
  maxMana: number,
  playerForge: number,
): number {
  return (
    companionBondLevel +
    talentEffects.companionDamage +
    gearEffects.companionDamageBonus +
    (effect.damageType === "bleed" ? talentEffects.companionBleedDamageBonus : 0) +
    trinketEffects.companionDamageBonus +
    companionDamageBuff +
    (enemyFreezeSkipTurns > 0 ? talentEffects.companionVsFrozenBonus : 0) +
    Math.round((maxMana * talentEffects.companionDamagePerManaCrystal) / HALF_DIVISOR) +
    (gearEffects.companionBenefitsFromForge > 0 && (effect.damageType === "physical" || effect.damageType === "stun")
      ? playerForge
      : 0)
  );
}

function scaleCompanionTurnEffect(
  effect: BattleCard["effects"][number],
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  gearEffects: BattleState["gearEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
  enemyFreezeSkipTurns: number,
  maxMana: number,
  playerForge: number,
  lowHealthMultiplier: number,
): BattleCard["effects"][number] {
  if (effect.kind === "damage") {
    const amountBonus = companionDamageBonusForEffect(
      effect,
      talentEffects,
      trinketEffects,
      gearEffects,
      companionDamageBuff,
      companionBondLevel,
      enemyFreezeSkipTurns,
      maxMana,
      playerForge,
    );
    return { ...effect, amount: Math.round((effect.amount + amountBonus) * lowHealthMultiplier) };
  }
  if (effect.kind === "chance") {
    const scaleNested = (nested: BattleCard["effects"][number]) =>
      scaleCompanionTurnEffect(
        nested,
        talentEffects,
        trinketEffects,
        gearEffects,
        companionDamageBuff,
        companionBondLevel,
        enemyFreezeSkipTurns,
        maxMana,
        playerForge,
        lowHealthMultiplier,
      );
    return {
      ...effect,
      successEffects: effect.successEffects.map(scaleNested),
      failureEffects: effect.failureEffects.map(scaleNested),
    };
  }
  return effect;
}

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
    effects: activeCompanion.turnStartEffects.map((effect) =>
      scaleCompanionTurnEffect(
        effect,
        talentEffects,
        trinketEffects,
        gearEffects,
        companionDamageBuff,
        companionBondLevel,
        enemyFreezeSkipTurns,
        maxMana,
        playerForge,
        lowHealthMultiplier,
      ),
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
    let afterEffects = processEncounterTraitCardAction(
      applyCardEffects(s, companionCard, combatTexts),
      companionCard,
      combatTexts,
    );

    const damageDealt = Math.max(0, s.enemyHealth - afterEffects.enemyHealth);
    if (damageDealt > 0 && state.gearEffects.healOnCompanionAttack > 0) {
      afterEffects = applyHealingWithCombatText(afterEffects, state.gearEffects.healOnCompanionAttack, combatTexts);
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (rollPercent(state.talentEffects.companionLeechChance, getBattleRng(state))) {
        const leechHeal = computeLeechHeal(damageDealt);
        if (leechHeal > 0) {
          afterEffects = applyHealingWithCombatText(afterEffects, leechHeal, combatTexts);
        }
      }
    }

    return afterEffects;
  });
}
