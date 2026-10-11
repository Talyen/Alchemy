import { hasEncounterBenefit } from "./encounter-trait-state";
import {
  BATTLE_CONFIG,
  HALF_DIVISOR,
  LABYRINTH_HALF_DAMAGE_WARDS,
  LABYRINTH_MODIFIER_CONFIG,
  MIN_ARMOR_AMOUNT,
  PERCENT_DENOMINATOR,
  POISON_DECAY_PERCENT,
  STATUS_DECAY_THRESHOLD,
  TRAIT_DAMAGE_RULES,
  TRAIT_DAMAGE_WEAKNESS_MULTIPLIER,
} from "../game-constants";
import { addPlayerStatusWithCombatText } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import type { BattleState, CombatTextEvent } from "./types";
import {
  applyPlayerCombatDamage,
  isPlayerDefeated,
  mitigatePlayerCombatDamage,
  playerHealthLostToDamage,
} from "./health-state";
import { decayEnemyArmor, reduceEnemyArmor } from "./enemy-mitigation-state";
import { getEnemyTraitSet } from "./encounter-trait-state";
import { scaleReceivedPlayerDamage } from "./damage-modifiers";
import { setPlayerStatus } from "./status-state";
import type { EnemyStatusDamageId } from "@/lib/game-data";
import { halveRounded } from "./amount-helpers";

export function decayHalvedStatus(value: number) {
  if (value <= STATUS_DECAY_THRESHOLD) return 0;
  return halveRounded(value);
}

export function decayPoisonStacks(stacks: number, decayMultiplier = 1): number {
  if (stacks <= 0) return 0;
  const decay = Math.max(1, Math.round((stacks * POISON_DECAY_PERCENT * decayMultiplier) / PERCENT_DENOMINATOR));
  return Math.max(0, stacks - decay);
}

export function getBurnBonusToBleedingMultiplier(state: Pick<BattleState, "enemyStatuses" | "gearEffects">): number {
  if (state.enemyStatuses.bleed <= 0 || state.gearEffects.burnDamageBonusToBleedingPercent <= 0) return 1;
  return 1 + state.gearEffects.burnDamageBonusToBleedingPercent / PERCENT_DENOMINATOR;
}

export function getPoisonBonusAgainstBleeding(
  state: Pick<BattleState, "enemyStatuses" | "talentEffects" | "gearEffects">,
): number {
  return state.enemyStatuses.bleed > 0
    ? state.talentEffects.bleedPoisonDamageTakenBonus + state.gearEffects.poisonBonusVsBleeding
    : 0;
}

export function getPoisonDamageMultiplierAgainstBleeding(
  state: Pick<BattleState, "enemyStatuses" | "talentEffects">,
): number {
  return state.enemyStatuses.bleed > 0
    ? 1 + state.talentEffects.bleedPoisonDamageTakenPercent / PERCENT_DENOMINATOR
    : 1;
}

const enemyTraitDamageMultipliers = new WeakMap<ReadonlySet<string>, ReadonlyMap<string, number>>();

export function getEnemyTraitDamageMultiplier(state: Pick<BattleState, "currentEnemy">, damageType: string): number {
  const traits = getEnemyTraitSet(state);
  let multipliers = enemyTraitDamageMultipliers.get(traits);
  if (!multipliers) {
    const resolved = new Map<string, number>();
    // Preserve authored multiplication order; wards apply once after all native traits.
    for (const rule of TRAIT_DAMAGE_RULES) {
      if (traits.has(rule.traitId))
        resolved.set(rule.damageType, (resolved.get(rule.damageType) ?? 1) * rule.multiplier);
    }
    const wardedTypes = new Set<string>();
    for (const rule of LABYRINTH_HALF_DAMAGE_WARDS) {
      if (!traits.has(rule.traitId) || wardedTypes.has(rule.damageType)) continue;
      wardedTypes.add(rule.damageType);
      resolved.set(rule.damageType, (resolved.get(rule.damageType) ?? 1) * LABYRINTH_MODIFIER_CONFIG.half);
    }
    multipliers = resolved;
    enemyTraitDamageMultipliers.set(traits, multipliers);
  }
  return multipliers.get(damageType) ?? 1;
}

export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyCC" | "talentEffects">,
  damageType: string,
): number {
  let multiplier = getEnemyTraitDamageMultiplier(state, damageType);
  if (state.enemyCC.stunSkipTurns > 0 && state.talentEffects.stunDoubleDamage)
    multiplier *= TRAIT_DAMAGE_WEAKNESS_MULTIPLIER;
  return multiplier;
}

export function getEnemyDamageVulnerabilityBonus(
  state: Pick<BattleState, "enemyCC" | "enemyStatuses" | "talentEffects">,
): number {
  return (
    (state.enemyCC.freezeSkipTurns > 0 ? state.talentEffects.freezeDamageBonusVsFrozen : 0) +
    (state.enemyStatuses.poison > 0 ? state.talentEffects.poisonDamageBonusVsPoisoned : 0)
  );
}

export function getBleedLowHealthDamageMultiplier(
  state: Pick<BattleState, "playerHealth" | "playerMaxHealth" | "talentEffects">,
): number {
  return state.playerHealth * HALF_DIVISOR < state.playerMaxHealth
    ? Math.max(1, state.talentEffects.bleedDesperateMultiplier)
    : 1;
}

export function reduceDamageByMana(
  state: Pick<BattleState, "mana" | "maxMana" | "gearEffects">,
  amount: number,
): number {
  const fullCrystals =
    state.gearEffects.damageReductionPerMana > 0 ? Math.max(0, Math.min(state.mana, state.maxMana)) : 0;
  return Math.max(0, amount - fullCrystals);
}

export function dealSelfDamage(
  state: BattleState,
  amount: number,
  statLabel: EnemyStatusDamageId | "health",
  combatTexts: CombatTextEvent[],
): { state: BattleState; healthLost: number; healthAfterDamage: number } {
  const healthCost = statLabel === "health";
  const scaled = healthCost
    ? amount
    : scaleReceivedPlayerDamage(reduceDamageByMana(state, amount), state.talentEffects, statLabel);
  const resisted = healthCost ? scaled : mitigatePlayerCombatDamage(state, scaled, statLabel);
  const resolvedDamage = armorMitigatesElementalDamage(state, statLabel)
    ? Math.max(0, resisted - state.playerStatuses.armor)
    : resisted;
  const postDamage = applyPlayerCombatDamage(
    state,
    resolvedDamage,
    "self",
    statLabel,
    { ignoreMitigation: true },
    combatTexts,
  );
  const healthLost = playerHealthLostToDamage(state, postDamage);
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: statLabel,
      amount: healthLost,
    });
  }
  return {
    state: healthCost ? postDamage : decayArmorAfterDamage(postDamage, resolvedDamage, "player", combatTexts),
    healthLost,
    healthAfterDamage: postDamage.playerHealth,
  };
}

export function applyPoisonDamageArmorRider(
  state: BattleState,
  damage: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (damage <= 0 || !state.talentEffects.poisonStripArmorByDamage) return state;
  const nextState = reduceEnemyArmor(state, damage);
  const removed = state.enemyMitigation.armor - nextState.enemyMitigation.armor;
  if (removed > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "armor", amount: removed, impact: false });
  }
  return nextState;
}

export type ArmorDecayTarget = "player" | "enemy";

export function armorMitigatesElementalDamage(state: BattleState, damageType: string): boolean {
  return (
    (damageType === "burn" && state.talentEffects.armorMitigatesBurn) ||
    (damageType === "bleed" && state.talentEffects.armorMitigatesBleed)
  );
}

export function removePlayerArmor(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  onArmorLost?: (amount: number) => void,
): BattleState {
  if (amount <= 0 || state.playerStatuses.armor <= 0) return state;
  const nextState = setPlayerStatus(state, "armor", Math.max(0, state.playerStatuses.armor - amount));
  onArmorLost?.(state.playerStatuses.armor - nextState.playerStatuses.armor);
  if (
    nextState.playerStatuses.armor === 0 &&
    nextState.talentEffects.armorBreakBlock > 0 &&
    !isPlayerDefeated(nextState)
  ) {
    return addPlayerStatusWithCombatText(nextState, "block", nextState.talentEffects.armorBreakBlock, combatTexts);
  }
  return nextState;
}

function decayPlayerArmor(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  onArmorLost?: (amount: number) => void,
): BattleState {
  if (hasEncounterBenefit(state, "ironclad") || state.playerStatuses.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }

  return removePlayerArmor(state, BATTLE_CONFIG.ARMOR_DECAY_AMOUNT, combatTexts, onArmorLost);
}

export function decayArmorAfterDamage(
  state: BattleState,
  damage: number,
  target: ArmorDecayTarget,
  combatTexts?: CombatTextEvent[],
  onArmorLost?: (amount: number) => void,
): BattleState {
  if (damage <= 0) return state;

  if (target === "enemy") {
    return decayEnemyArmor(state);
  }
  return decayPlayerArmor(state, combatTexts, onArmorLost);
}
