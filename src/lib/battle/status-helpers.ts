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
import { applyPlayerCombatDamage, type BattleState, type CombatTextEvent, type CombatTextStat } from "./types";
import { getBattleRng, rollPercent } from "../rng";
import { halveRounded } from "./amount-helpers";

export function decayHalvedStatus(value: number) {
  if (value <= STATUS_DECAY_THRESHOLD) return 0;
  return halveRounded(value);
}

export function decayPoisonStacks(stacks: number): number {
  if (stacks <= 0) return 0;
  const decay = Math.max(1, Math.round((stacks * POISON_DECAY_PERCENT) / PERCENT_DENOMINATOR));
  return Math.max(0, stacks - decay);
}

export function getBurnBonusToBleedingMultiplier(state: Pick<BattleState, "enemyStatuses" | "gearEffects">): number {
  if (state.enemyStatuses.bleed <= 0 || state.gearEffects.burnDamageBonusToBleedingPercent <= 0) return 1;
  return 1 + state.gearEffects.burnDamageBonusToBleedingPercent / PERCENT_DENOMINATOR;
}

export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyCC" | "talentEffects">,
  damageType: string,
): number {
  const traits = state.currentEnemy.traits;
  for (const rule of TRAIT_DAMAGE_RULES) {
    if (damageType === rule.damageType && traits.some((t) => t.id === rule.traitId)) {
      return rule.multiplier;
    }
  }
  let multiplier = 1;
  if (state.enemyCC.stunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  return multiplier;
}

export function dealSelfDamage(
  state: BattleState,
  amount: number,
  statLabel: CombatTextStat,
  combatTexts: CombatTextEvent[],
): { state: BattleState; healthLost: number } {
  const postDamage = applyPlayerCombatDamage(state, amount);
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

function decayEnemyArmor(state: BattleState): BattleState {
  if (state.enemyMitigation.armor <= MIN_ARMOR_AMOUNT) {
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
  if (state.playerStatuses.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }

  const armorBefore = state.playerStatuses.armor;
  let nextState: BattleState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: Math.max(0, state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };

  const armorBroke = armorBefore > MIN_ARMOR_AMOUNT && nextState.playerStatuses.armor === MIN_ARMOR_AMOUNT;
  const hasArmorBreakTalent = nextState.talentEffects.armorBreakBlock > 0;

  if (armorBroke && hasArmorBreakTalent) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", nextState.talentEffects.armorBreakBlock, combatTexts);
  }

  return nextState;
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
