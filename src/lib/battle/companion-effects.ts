import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { damageOnlyEffects } from "./damage-effect-selection";
import { getModifiedCompanionEffects, type BattleCard } from "@/lib/game-data";
import { isPlayerDefeated, type BattleState, type CombatTextEvent, withPreservedFlags } from "./types";
import { addBloodDebtHealing, applyLeechHealing, computeLeechHeal, scalePlayerLeechHeal } from "./damage-rider-leech";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText } from "./combat-text";
import { rollTalentChance } from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { dealTalentTypedHit } from "./player-typed-hit";
import { scaledGearLeechHeal } from "./gear-effects";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";

export function resolveCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  applyEffects: (
    state: BattleState,
    card: BattleCard,
    combatTexts: CombatTextEvent[],
    context?: CardEffectResolutionContext,
  ) => BattleState,
  options?: { damageOnly?: boolean },
) {
  if (!state.activeCompanion || state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  const companionCard: BattleCard = {
    id: `companion-${state.activeCompanion.id}`,
    title: state.activeCompanion.title,
    descriptionLines: [],
    art: state.activeCompanion.art,
    cost: 0,
    effects: getModifiedCompanionEffects(
      state.activeCompanion,
      state.talentEffects.companionBondLevels?.[state.activeCompanion.id] ?? 0,
      getBattleCompanionDamageModifiers(state),
    ),
  };

  if (options?.damageOnly) companionCard.effects = damageOnlyEffects(companionCard.effects);

  return withPreservedFlags(state, (s) => {
    const attackBonuses = { flat: s.flags.companionNextAttackBonus, physical: 0, bleed: 0 };
    const damageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
    let damageDealt = 0;
    let afterEffects = processEncounterTraitCardAction(
      applyEffects(s, companionCard, combatTexts, {
        manaAtStart: s.mana,
        enemyFreezeSkipTurnsAtStart: s.enemyCC.freezeSkipTurns,
        attackBonuses,
        companionAttack: true,
        damageEffects,
        onDamageDealt: (amount) => {
          damageDealt += amount;
        },
      }),
      companionCard,
      combatTexts,
      damageEffects.length > 0,
      { cardPlayed: false },
    );

    afterEffects = { ...afterEffects, flags: { ...afterEffects.flags, companionNextAttackBonus: attackBonuses.flat } };
    if (damageDealt > 0 && state.gearEffects.healOnCompanionAttack > 0) {
      afterEffects = applyHealingWithCombatText(afterEffects, state.gearEffects.healOnCompanionAttack, combatTexts);
    }

    if (damageDealt > 0 && state.talentEffects.blockOnCompanionDamage > 0) {
      afterEffects = addPlayerStatusWithCombatText(
        afterEffects,
        "block",
        state.talentEffects.blockOnCompanionDamage,
        combatTexts,
      );
    }

    if (damageDealt > 0 && state.talentEffects.companionStunChance > 0) {
      if (rollTalentChance(state.talentEffects.companionStunChance, state)) {
        afterEffects = dealTalentTypedHit(afterEffects, "stun", damageDealt, combatTexts, true);
      }
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (rollPercent(state.talentEffects.companionLeechChance, getBattleRng(state))) {
        const leechHeal = scalePlayerLeechHeal(
          afterEffects,
          scaledGearLeechHeal(
            addBloodDebtHealing(afterEffects, computeLeechHeal(damageDealt)),
            afterEffects.gearEffects,
          ),
        );
        if (leechHeal > 0) {
          afterEffects = applyLeechHealing(afterEffects, leechHeal, combatTexts);
        }
      }
    }

    return resolvePendingBattleReactions(afterEffects, combatTexts);
  });
}
