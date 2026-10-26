import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR } from "../game-constants";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { damageOnlyEffects } from "./card-classification";
import { getModifiedCompanionEffects, type BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent, BattleResourceReward } from "./types";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";

/** Shared action scope, captured hit facts, reward ordering, and fatal cutoffs. */
export interface CompanionResolutionPort {
  chance: (chance: number, state: BattleState) => boolean;
  afterAction: (state: BattleState, card: BattleCard, texts: CombatTextEvent[], attacked: boolean) => BattleState;
  forge: BattleResourceReward;
  heal: BattleResourceReward;
  stun: BattleResourceReward;
  leech: BattleResourceReward;
  mana: BattleResourceReward;
  settle: (state: BattleState, texts: CombatTextEvent[]) => BattleState;
}

export function resolveCompanionAction(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  applyEffects: (
    state: BattleState,
    card: BattleCard,
    combatTexts: CombatTextEvent[],
    context?: CardEffectResolutionContext,
  ) => BattleState,
  port: CompanionResolutionPort,
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
    let afterEffects = port.afterAction(
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
    );

    afterEffects = {
      ...afterEffects,
      flags: { ...afterEffects.flags, companionNextAttackBonus: companionAttackBonus.amount },
    };
    if (isPlayerDefeated(afterEffects)) return afterEffects;
    if (damageDealt > 0 && burningEnemy) {
      afterEffects = port.forge(
        afterEffects,
        s.gearEffects.forgeOnCompanionDamageVsBurningChances.reduce(
          (total, chance) => total + Number(port.chance(chance, afterEffects)),
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
      afterEffects = port.heal(afterEffects, afterEffects.gearEffects.healOnCompanionAttack, combatTexts);
    }

    if (damageDealt > 0 && afterEffects.enemyHealth > 0 && state.talentEffects.companionStunChance > 0) {
      if (port.chance(state.talentEffects.companionStunChance, state)) {
        afterEffects = port.stun(afterEffects, damageDealt, combatTexts);
      }
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (port.chance(state.talentEffects.companionLeechChance, state)) {
        afterEffects = port.leech(afterEffects, damageDealt, combatTexts);
      }
    }

    for (let index = 0; index < damagePackets; index += 1) {
      if (port.chance(afterEffects.talentEffects.companionManaChance, afterEffects)) {
        afterEffects = port.mana(afterEffects, 1, combatTexts);
      }
    }

    return port.settle(afterEffects, combatTexts);
  });
}
