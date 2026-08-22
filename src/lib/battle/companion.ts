/**
 * Companion turn-start resolution: builds a synthetic 0-cost card from the companion's
 * turnStartEffects and applies it as if played. Depends on: effect-handlers, types, game-data.
 * Depended on by: battle start and post-draw companion follow-up (player turn start).
 */
import { applyCardEffects } from "./effect-handlers";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { addPlayerStatus, type BattleState, type CombatTextEvent, withPreservedFlags } from "./types";
import { LOW_HEALTH_THRESHOLD_PERCENT, computeLeechHeal, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { rollPercent, getBattleRng } from "./status-helpers";
import { rollTalentChance } from "./status-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealPlayerTypedHit } from "./player-typed-hit";

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
  const companionBondLevel = state.talentEffects.companionBondLevels?.[state.activeCompanion.id] ?? 0;

  const lowHealthThreshold = Math.round((state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR);
  const lowHealthMultiplier =
    state.talentEffects.companionDoubledVsLowHealth && state.enemyHealth <= lowHealthThreshold ? 2 : 1;

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

    if (damageDealt > 0 && state.talentEffects.blockOnCompanionDamage > 0) {
      const before = afterEffects.playerStatuses.block;
      afterEffects = addPlayerStatus(
        afterEffects,
        "block",
        paceCombatMagnitude(afterEffects, state.talentEffects.blockOnCompanionDamage, "player"),
      );
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: afterEffects.playerStatuses.block - before,
      });
    }

    if (damageDealt > 0 && state.talentEffects.companionStunChance > 0) {
      if (rollTalentChance(state.talentEffects.companionStunChance, state)) {
        afterEffects = dealPlayerTypedHit(afterEffects, "stun", damageDealt, combatTexts);
      }
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (rollPercent(state.talentEffects.companionLeechChance, getBattleRng(state))) {
        const leechHeal = computeLeechHeal(damageDealt);
        if (leechHeal > 0) {
          afterEffects = applyHealingWithCombatText(afterEffects, leechHeal, combatTexts, { skipFightPacing: true });
        }
      }
    }

    return afterEffects;
  });
}
