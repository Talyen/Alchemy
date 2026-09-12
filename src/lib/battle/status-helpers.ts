import { hasEncounterBenefit, hasEnemyTrait } from "./types";
import {
  BATTLE_CONFIG,
  MIN_ARMOR_AMOUNT,
  PERCENT_DENOMINATOR,
  POISON_DECAY_PERCENT,
  STATUS_DECAY_THRESHOLD,
  TRAIT_DAMAGE_RULES,
  TRAIT_DAMAGE_WEAKNESS,
} from "../game-constants";
import { addPlayerStatusWithCombatText, mergeCombatText } from "./combat-text";
import {
  applyPlayerCombatDamage,
  isPlayerDefeated,
  scaleReceivedPlayerDamage,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import type { EnemyStatusDamageId } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
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

export function getPoisonBonusAgainstBleeding(state: Pick<BattleState, "enemyStatuses" | "talentEffects">): number {
  return state.enemyStatuses.bleed > 0 ? state.talentEffects.bleedPoisonDamageTakenBonus : 0;
}

export function getEnemyTraitDamageMultiplier(state: Pick<BattleState, "currentEnemy">, damageType: string): number {
  const traits = state.currentEnemy.traits;
  for (const rule of TRAIT_DAMAGE_RULES) {
    if (damageType === rule.damageType && traits.some((t) => t.id === rule.traitId)) return rule.multiplier;
  }
  return 1;
}

export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyCC" | "talentEffects">,
  damageType: string,
): number {
  let multiplier = getEnemyTraitDamageMultiplier(state, damageType);
  if (state.enemyCC.stunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  return multiplier;
}

export function dealSelfDamage(
  state: BattleState,
  amount: number,
  statLabel: EnemyStatusDamageId | "health",
  combatTexts: CombatTextEvent[],
): { state: BattleState; healthLost: number } {
  const healthCost = statLabel === "health";
  const scaled = healthCost ? amount : scaleReceivedPlayerDamage(amount, state.talentEffects, statLabel);
  const damage = armorMitigatesElementalDamage(state, statLabel)
    ? Math.max(0, scaled - state.playerStatuses.armor)
    : scaled;
  const postDamage = applyPlayerCombatDamage(
    state,
    damage,
    "self",
    statLabel,
    { ignoreMitigation: healthCost },
    combatTexts,
  );
  const healthLost = Math.max(0, state.playerHealth - postDamage.playerHealth);
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: statLabel,
      amount: healthLost,
    });
  }
  return { state: postDamage, healthLost };
}

export function rollTalentChance(chance: number, state: { rng?: () => number }): boolean {
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}

export type ArmorDecayTarget = "player" | "enemy";

export function armorMitigatesElementalDamage(state: BattleState, damageType: string): boolean {
  return (
    (damageType === "burn" && state.talentEffects.armorMitigatesBurn) ||
    (damageType === "bleed" && state.talentEffects.armorMitigatesBleed)
  );
}

export function removePlayerArmor(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]): BattleState {
  if (amount <= 0 || state.playerStatuses.armor <= 0) return state;
  const nextState = setPlayerStatus(state, "armor", Math.max(0, state.playerStatuses.armor - amount));
  if (
    nextState.playerStatuses.armor === 0 &&
    nextState.talentEffects.armorBreakBlock > 0 &&
    !isPlayerDefeated(nextState)
  ) {
    return addPlayerStatusWithCombatText(nextState, "block", nextState.talentEffects.armorBreakBlock, combatTexts);
  }
  return nextState;
}

function decayEnemyArmor(state: BattleState): BattleState {
  if (hasEnemyTrait(state, "unbreakable") || state.enemyMitigation.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };
}

function decayPlayerArmor(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (hasEncounterBenefit(state, "ironclad") || state.playerStatuses.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }

  return removePlayerArmor(state, BATTLE_CONFIG.ARMOR_DECAY_AMOUNT, combatTexts);
}

export function decayArmorAfterDamage(
  state: BattleState,
  damage: number,
  target: ArmorDecayTarget,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (damage <= 0) return state;

  if (target === "enemy") {
    return decayEnemyArmor(state);
  }
  return decayPlayerArmor(state, combatTexts);
}
