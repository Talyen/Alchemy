// Enemy attack resolution: damage, block, armor, and attack effect dispatch.
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { applyPlayerStatusFromAttack } from "./status-application";
import { applyPlayerDamageStatuses } from "./status-effects";
import type { EnemyAttackEffect } from "@/lib/game-data";
import { logError } from "../error-logger";
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
  type CombatTextStat,
} from "./types";
import { BATTLE_CONFIG, computeLeechHeal, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { checkHealthThresholds, isFreezeActiveForAspect } from "./enemy-turn-utils";

function applyPhysicalForgeBonus(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  if (effect.damageType !== "physical") return effect.amount;
  return effect.amount + state.enemyMitigation.forge;
}

function computeEffectiveBlock(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.round(
      effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR),
    );
  }
  return effectiveBlock;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
) {
  const rawDamage =
    effect.damageType === "physical" ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  const actualDamage =
    effect.damageType === "holy" && state.talentEffects.receiveHalfHolyDamage
      ? Math.round(rawDamage / HALF_DIVISOR)
      : rawDamage;
  return actualDamage;
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  if (state.enemyStatuses.poison > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.poisonReducesEnemyDamage);
  }
  if (effect.damageType === "burn") {
    remainingDamage += state.enemyMitigation.burnBonus;
  }
  const effectiveBlock = computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage);
  return { remainingDamage, blockAbsorb, actualDamage };
}

function applyVanguardCrestAfterBlock(
  state: BattleState,
  blockAbsorb: number,
  remainingDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.trinketEffects.vanguardCrestForgeOnBlockAbsorb <= 0 || blockAbsorb <= 0 || remainingDamage !== 0) {
    return state;
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "forge",
    amount: state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
  });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: state.playerStatuses.forge + state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
    },
  };
}

function applyArmorDecayOnHit(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (actualDamage <= 0 || state.playerStatuses.armor <= 0) return state;
  const armorBefore = state.playerStatuses.armor;
  let nextState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: Math.max(0, state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };
  if (armorBefore > 0 && nextState.playerStatuses.armor === 0 && nextState.talentEffects.armorBreakBlock > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: nextState.playerStatuses.block + nextState.talentEffects.armorBreakBlock,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "block",
      amount: nextState.talentEffects.armorBreakBlock,
    });
  }
  return nextState;
}

function applyEnemyForgeDecayOnHit(state: BattleState, actualDamage: number, damageType: string): BattleState {
  if (actualDamage <= 0 || damageType !== "physical" || state.enemyMitigation.forge <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: Math.max(0, state.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
}

function resolvePostDamageThresholds(
  state: BattleState,
  prevHealth: number,
  blockAbsorb: number,
  remainingDamage: number,
  actualDamage: number,
  damageType: string,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyVanguardCrestAfterBlock(state, blockAbsorb, remainingDamage, combatTexts);
  nextState = checkHealthThresholds(prevHealth, nextState.playerHealth, nextState, combatTexts);
  nextState = applyArmorDecayOnHit(nextState, actualDamage, combatTexts);
  nextState = applyEnemyForgeDecayOnHit(nextState, actualDamage, damageType);
  return nextState;
}

function applyEnemyAttackLifesteal(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (isFreezeActiveForAspect(state, "regen")) return state;
  if (state.talentEffects.blockEnemyLeech) return state;
  const healAmount = computeLeechHeal(actualDamage);
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth),
  };
}

function recordPlayerHealthLost(
  prevHealth: number,
  nextState: BattleState,
  damageType: CombatTextStat,
  combatTexts: CombatTextEvent[],
) {
  const healthLost = prevHealth - nextState.playerHealth;
  if (healthLost > 0) {
    const stat = damageType === "physical" ? "health" : damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: healthLost });
  }
}

function applyBlockDepletedHeal(
  prevState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    prevState.talentEffects.blockDepletedHeal > 0 &&
    prevState.playerStatuses.block > 0 &&
    nextState.playerStatuses.block <= 0
  ) {
    const healedState = applyPlayerHealing(nextState, prevState.talentEffects.blockDepletedHeal);
    emitOverhealBlockText(nextState, healedState, combatTexts);
    return healedState;
  }
  return nextState;
}

function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  const { remainingDamage, blockAbsorb, actualDamage } = calculateBlockAndArmorMitigation(state, effect, combatTexts);

  const prevHealth = state.playerHealth;
  const damagedState = applyPlayerCombatDamage(state, actualDamage, effect.damageType);
  let nextState: BattleState = {
    ...damagedState,
    playerStatuses: {
      ...damagedState.playerStatuses,
      block: damagedState.playerStatuses.block - Math.min(blockAbsorb, damagedState.playerStatuses.block),
    },
  };

  recordPlayerHealthLost(prevHealth, nextState, effect.damageType, combatTexts);
  nextState = applyBlockDepletedHeal(state, nextState, combatTexts);

  nextState = resolvePostDamageThresholds(
    nextState,
    prevHealth,
    blockAbsorb,
    remainingDamage,
    actualDamage,
    effect.damageType,
    combatTexts,
  );

  // Status rider: status-linked damage types (burn, poison, bleed, freeze, stun)
  // apply their status to the player equal to the actual damage dealt,
  // mirroring how player-side damage riders work (damage.ts applyDamageStatuses).
  nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);

  if (effect.lifesteal && actualDamage > 0) {
    nextState = applyEnemyAttackLifesteal(nextState, actualDamage, combatTexts);
  }

  return nextState;
}

export function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const effect of state.enemyAttackEffects) {
    try {
      if (effect.kind === "damage") {
        nextState = processEnemyDamageEffect(nextState, effect, combatTexts);
      } else if (effect.kind === "player-status") {
        nextState = applyPlayerStatusFromAttack(nextState, effect, combatTexts);
      } else {
        const errMsg = `Unknown enemy attack effect kind: ${(effect as { kind: string }).kind}`;
        console.warn("[Enemy Turn]", errMsg);
        logError(errMsg, "battle", { state: nextState });
        if (import.meta.env.DEV) throw new Error(errMsg);
      }
    } catch (err) {
      logError(`Enemy attack effect failed: ${(err as Error).message}`, "battle", { effect });
    }
  }

  return nextState;
}
