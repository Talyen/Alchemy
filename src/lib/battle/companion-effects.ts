import { rollBattleChance } from "./chance-roll";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import type { BattleState, CombatTextEvent } from "./types";
import { applyScaledLeechHealing, computeLeechHeal } from "./damage-rider-leech";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { addForgeToPlayer } from "./player-rewards";
import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR } from "../game-constants";
import { damageOnlyEffects } from "./card-classification";
import { getModifiedCompanionEffects, type BattleCard } from "@/lib/game-data";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";

// The effect interpreter stays injected to avoid importing the registry that calls this owner.
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
  if (!state.activeCompanion || getBattleOutcome(state) !== null) return state;

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

  return resolveSecondaryAction(state, "companion", (s) => {
    const burningEnemy = s.enemyStatuses.burn > 0;
    const companionAttackBonus = { amount: s.flags.companionNextAttackBonus };
    const damageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
    const attackAttempted = { value: false };
    let damageDealt = 0;
    let damagePackets = 0;
    let afterEffects = processEncounterTraitCardAction(
      applyEffects(s, companionCard, combatTexts, {
        manaAtStart: s.mana,
        companionAttackBonus,
        origin: "companion",
        damageEffects,
        attackAttempted,
        onDamageDealt: (amount) => {
          damageDealt += amount;
          if (amount > 0) damagePackets += 1;
        },
      }),
      companionCard,
      combatTexts,
      damageEffects.length > 0 || attackAttempted.value,
      { cardPlayed: false },
    );

    afterEffects = {
      ...afterEffects,
      flags: { ...afterEffects.flags, companionNextAttackBonus: companionAttackBonus.amount },
    };
    if (isPlayerDefeated(afterEffects)) return afterEffects;
    if (damageDealt > 0 && burningEnemy) {
      afterEffects = addForgeToPlayer(
        afterEffects,
        s.gearEffects.forgeOnCompanionDamageVsBurningChances.reduce(
          (total, chance) => total + Number(rollBattleChance(chance, afterEffects)),
          0,
        ),
        combatTexts,
      );
    }
    if (
      damageDealt > 0 &&
      afterEffects.gearEffects.healOnCompanionAttack > 0 &&
      // Kill healing must not cancel eligibility; retaliation can also move
      // the player below half Health during this Companion action.
      (s.playerHealth < s.playerMaxHealth / HALF_DIVISOR ||
        afterEffects.playerHealth < afterEffects.playerMaxHealth / HALF_DIVISOR)
    ) {
      afterEffects = applyHealingWithCombatText(
        afterEffects,
        afterEffects.gearEffects.healOnCompanionAttack,
        combatTexts,
      );
    }

    if (damageDealt > 0 && afterEffects.enemyHealth > 0 && state.talentEffects.companionStunChance > 0) {
      if (rollBattleChance(state.talentEffects.companionStunChance, state)) {
        afterEffects = resolveFollowUpHit(
          afterEffects,
          { source: "talent-derived", damageType: "stun", amount: damageDealt },
          combatTexts,
        );
      }
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (rollBattleChance(state.talentEffects.companionLeechChance, state)) {
        afterEffects = applyScaledLeechHealing(afterEffects, computeLeechHeal(damageDealt), combatTexts);
      }
    }

    for (let index = 0; index < damagePackets; index += 1) {
      if (rollBattleChance(afterEffects.talentEffects.companionManaChance, afterEffects)) {
        afterEffects = gainManaWithCombatText(afterEffects, 1, combatTexts);
      }
    }

    return resolvePendingBattleReactions(afterEffects, combatTexts);
  });
}
