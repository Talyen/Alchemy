import { readCombatFlag } from "./action-context";
import type { BattleCard, BattleCardEffect, DamageType } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  CRIT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE_PERCENT,
  LABYRINTH_MODIFIER_CONFIG,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { paceCombatDamage } from "./fight-pacing";
import { applyFirstDamageBonus, computeBaseDamage, resolveDamageBonusMultiplier } from "./player-damage-bonuses";
import { getEnemyDamageMultiplier, getEnemyTraitDamageMultiplier } from "./status-helpers";
import { hasEncounterBenefit, reduceEnemyArmor, setFlag, type BattleState } from "./types";
export { forgeAppliesToDamageType } from "./player-damage-bonuses";

function applyCrit(damage: number, state: BattleState) {
  const critical = readCombatFlag(state, "nextHitCrit") || rollPercent(GLOBAL_CRIT_CHANCE_PERCENT, getBattleRng(state));
  return critical && damage > 0
    ? damage * CRIT_MULTIPLIER + (state.talentEffects.homesteadCriticalDamage ?? 0)
    : damage;
}

function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean, card?: BattleCard): BattleState {
  if (!isPhysicalOrStun) return state;
  let pierce = state.trinketEffects.sunderingArmorPiercing + state.gearEffects.armorPiercing;
  if (card?.tags?.includes("archery")) {
    pierce += state.gearEffects.archeryArmorPiercing + state.talentEffects.archeryArmorPiercing;
  }
  if (pierce <= 0) return state;
  return reduceEnemyArmor(state, pierce);
}

function applyBlockAbsorption(
  state: BattleState,
  damage: number,
  ignoreBlock = false,
): { state: BattleState; remainingDamage: number } {
  const effectiveBlock = ignoreBlock ? 0 : state.enemyMitigation.block;
  const blockAbsorbed = Math.min(damage, effectiveBlock);
  const remainingDamage = Math.max(0, damage - blockAbsorbed);
  let nextState = state;
  if (blockAbsorbed > 0) {
    nextState = {
      ...nextState,
      enemyMitigation: {
        ...nextState.enemyMitigation,
        block: nextState.enemyMitigation.block - blockAbsorbed,
      },
    };
  }
  return { state: nextState, remainingDamage };
}

export function computeTalentDamageToEnemy(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  source: "talent-fixed" | "talent-derived",
) {
  const base = source === "talent-derived" ? Math.round(amount) : paceCombatDamage(state, amount, "player");
  const multiplier =
    source === "talent-derived"
      ? getEnemyTraitDamageMultiplier(state, damageType)
      : getEnemyDamageMultiplier(state, damageType);
  const damage = Math.max(0, Math.round(base * multiplier));
  const afterBlock = applyBlockAbsorption(state, damage);
  const armor = damageType === "physical" || damageType === "stun" ? state.enemyMitigation.armor : 0;
  return { state: afterBlock.state, remainingDamage: Math.max(0, afterBlock.remainingDamage - armor) };
}

export function computeReflectedHolyDamageToEnemy(state: BattleState, blockLost: number) {
  const damage = Math.round(
    (blockLost * state.talentEffects.holyReflectionBlockLostPercent * getEnemyTraitDamageMultiplier(state, "holy")) /
      PERCENT_DENOMINATOR,
  );
  return applyBlockAbsorption(state, damage);
}

const ENCOUNTER_FIRST_HIT_BY_DAMAGE_TYPE = {
  physical: { id: "heavy-hand", flag: "encounterPhysicalUsed" },
  holy: { id: "consecrated", flag: "encounterHolyUsed" },
  nature: { id: "wildheart", flag: "encounterNatureUsed" },
} as const;

function resolveEncounterFirstHit(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  playedCard: boolean,
): { state: BattleState; multiplier: number } {
  const firstAttack =
    ENCOUNTER_FIRST_HIT_BY_DAMAGE_TYPE[effect.damageType as keyof typeof ENCOUNTER_FIRST_HIT_BY_DAMAGE_TYPE] ?? null;
  if (
    playedCard &&
    firstAttack &&
    hasEncounterBenefit(state, firstAttack.id) &&
    !readCombatFlag(state, firstAttack.flag)
  ) {
    return { state: setFlag(state, firstAttack.flag, true), multiplier: LABYRINTH_MODIFIER_CONFIG.double };
  }
  return { state, multiplier: 1 };
}

function resolveDamageAfterMitigation(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card: BattleCard | undefined,
  finalDamage: number,
): { nextState: BattleState; modifiedDamage: number } {
  const { state: stateAfterBlock, remainingDamage: damageAfterBlock } = applyBlockAbsorption(
    state,
    finalDamage,
    effect.ignoreBlock === true,
  );
  const stateWithCritCleared = readCombatFlag(stateAfterBlock, "nextHitCrit")
    ? setFlag(stateAfterBlock, "nextHitCrit", false)
    : stateAfterBlock;
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const serpent = state.gearEffects.poisonedAttacksPierce > 0 && state.enemyStatuses.poison > 0 && card !== undefined;
  const kingbreaker = effect.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0;
  const nextState =
    serpent || kingbreaker
      ? stateWithCritCleared
      : applySunderingArmorPiercing(stateWithCritCleared, isPhysicalOrStun, card);
  const effectiveArmor =
    isPhysicalOrStun && !serpent && !kingbreaker && !effect.ignoreArmor ? nextState.enemyMitigation.armor : 0;
  return { nextState, modifiedDamage: Math.max(0, damageAfterBlock - effectiveArmor) };
}

export function computeCardDamageToEnemy(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  context?: CardEffectResolutionContext,
) {
  const encounter = resolveEncounterFirstHit(state, effect, context?.origin === "played-card");
  state = encounter.state;
  const baseDamage = computeBaseDamage(state, effect, card, context?.baseDamageBonus, context?.origin === "companion");
  const { state: stateAfterFirst, firstBonus } = applyFirstDamageBonus(state, effect);
  const totalMultiplier = resolveDamageBonusMultiplier(
    stateAfterFirst,
    effect,
    card,
    firstBonus,
    context?.origin === "companion",
  );
  const scaledDamage = Math.round(baseDamage * totalMultiplier * encounter.multiplier);
  const pacedDamage = paceCombatDamage(stateAfterFirst, scaledDamage, "player");
  const repeatedDamage = Math.round(pacedDamage * (context?.damageMultiplier ?? 1));
  const criticalDamage = context?.guaranteedCrit
    ? repeatedDamage * CRIT_MULTIPLIER +
      (repeatedDamage > 0 ? (stateAfterFirst.talentEffects.homesteadCriticalDamage ?? 0) : 0)
    : applyCrit(repeatedDamage, stateAfterFirst);
  const kingbreaker = effect.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0;
  const finalDamage = criticalDamage + (kingbreaker ? state.enemyMitigation.armor : 0);

  return resolveDamageAfterMitigation(stateAfterFirst, effect, card, finalDamage);
}
