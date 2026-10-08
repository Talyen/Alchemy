import type { BattleState, CombatTextEvent } from "./types";
import { CAMPFIRE_HEAL_FRACTION, DEATHS_DOOR_GRACE_TURNS } from "../game-constants";
import { halveRounded } from "./amount-helpers";
import { clamp } from "@/lib/math";
import { flatDamageReduction, applyGearDamageResistance } from "./damage-modifiers";
import { hasEnemyTrait } from "./encounter-trait-state";
import { addPlayerStatus, blockAmountWithForge } from "./status-state";
export function clampHealth(current: number, delta: number, max: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(delta) || !Number.isFinite(max)) {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeMax = Number.isFinite(max) && max > 0 ? max : safeCurrent;
    const safeDelta = Number.isFinite(delta) ? delta : 0;
    return clamp(safeCurrent + safeDelta, 0, safeMax);
  }
  return clamp(current + delta, 0, max);
}

export interface EnemyHitHealth {
  state: BattleState;
  previousHealth: number;
  enemyWasAlive: boolean;
  resolvedDamage: number;
  healthDamage: number;
  killed: boolean;
}

export function damageEnemyHealth(state: BattleState, damage: number): EnemyHitHealth {
  const previousHealth = state.enemyHealth;
  const enemyHealth = clampHealth(previousHealth, -damage, state.enemyMaxHealth);
  const triggersCinderSkin =
    enemyHealth > 0 &&
    enemyHealth < previousHealth &&
    hasEnemyTrait(state, "cinder-skin") &&
    !state.flags.cinderSkinUsedThisTurn;
  return {
    state: {
      ...state,
      enemyHealth,
      ...(triggersCinderSkin
        ? {
            flags: { ...state.flags, cinderSkinUsedThisTurn: true, pendingCinderSkinReaction: true },
          }
        : {}),
    },
    previousHealth,
    enemyWasAlive: previousHealth > 0,
    resolvedDamage: damage,
    healthDamage: Math.max(0, previousHealth - enemyHealth),
    killed: previousHealth > 0 && enemyHealth <= 0,
  };
}

export function deathsDoorGraceTurns(extension: number): number {
  return DEATHS_DOOR_GRACE_TURNS + Math.max(0, extension);
}

export interface EnemyTraitIgnoreMitigationOptions {
  ignoreMitigation?: boolean;
}

export function mitigatePlayerCombatDamage(
  state: BattleState,
  damage: number,
  damageType?: string,
  options?: EnemyTraitIgnoreMitigationOptions,
): number {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  let reducedDamage = damage;
  if (!options?.ignoreMitigation) {
    reducedDamage -= state.talentEffects.damageReduction;
    if (state.activeCompanion && state.talentEffects.damageReductionWithCompanion > 0) {
      reducedDamage -= state.talentEffects.damageReductionWithCompanion;
    }
    reducedDamage -= flatDamageReduction(state.talentEffects, damageType);
    reducedDamage = Math.max(0, reducedDamage);
    reducedDamage = applyGearDamageResistance(reducedDamage, damageType, state.gearEffects);
    if (
      state.playerStatuses.block > 0 &&
      ((damageType === "bleed" && state.talentEffects.blockHalvesBleedDamage) ||
        (damageType === "poison" && state.talentEffects.blockHalvesPoisonDamage))
    ) {
      reducedDamage = halveRounded(reducedDamage);
    }
  }
  return reducedDamage;
}

export function applyPlayerCombatDamage(
  state: BattleState,
  damage: number,
  source: "hostile" | "self",
  damageType?: string,
  options?: EnemyTraitIgnoreMitigationOptions,
  combatTexts?: CombatTextEvent[],
): BattleState {
  const reducedDamage = mitigatePlayerCombatDamage(state, damage, damageType, options);
  if (reducedDamage <= 0) return state;
  const nextHealth = clampHealth(state.playerHealth, -reducedDamage, state.playerMaxHealth);
  if (source === "hostile" && nextHealth < state.playerHealth && state.talentEffects.dodgeChanceOnHostileDamage > 0) {
    state = {
      ...state,
      dodgeChanceFromDamage: state.dodgeChanceFromDamage + state.talentEffects.dodgeChanceOnHostileDamage,
    };
  }
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (state.playerStatuses.phoenixFeather > 0) {
    const healAmount = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
    combatTexts?.push({ target: "player", kind: "notice", stat: "phoenixFeather", text: "Revived" });
    combatTexts?.push({ target: "player", kind: "heal", stat: "health", amount: healAmount });
    return {
      ...state,
      playerHealth: healAmount,
      playerStatuses: { ...state.playerStatuses, phoenixFeather: 0 },
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  if (!state.deathsDoorUsed) {
    return {
      ...state,
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
      deathsDoorGraceTurnsRemaining: deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension),
      flags:
        state.gearEffects.burnOnDeathsDoorEntry > 0 ? { ...state.flags, pendingEmberwakeDamage: true } : state.flags,
    };
  }
  if (state.deathsDoorActive) {
    if (state.playerHealth === 1 && reducedDamage > 0) {
      combatTexts?.push({ target: "player", kind: "notice", stat: "deathsDoor", text: "" });
    }
    return { ...state, playerHealth: 1 };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: false, dodgeChanceFromDamage: 0 };
}

/** Read immediately after damage, before rewards: Phoenix restores Health after the lethal loss; Death's Door prevents it. */
export function playerHealthLostToDamage(before: BattleState, after: BattleState): number {
  const phoenixTriggered = before.playerStatuses.phoenixFeather > 0 && after.playerStatuses.phoenixFeather === 0;
  return phoenixTriggered ? before.playerHealth : Math.max(0, before.playerHealth - after.playerHealth);
}

export function effectivePlayerHealingAmount(state: BattleState, amount: number): number {
  return Math.round(
    (amount + (amount > 0 ? (state.talentEffects.homesteadHealing ?? 0) : 0)) * state.talentEffects.healMultiplier,
  );
}

export function applyPlayerHealing(state: BattleState, amount: number, allowOverhealBlock = false): BattleState {
  return resolvePlayerHealing(state, amount, allowOverhealBlock).state;
}

export function resolvePlayerHealing(state: BattleState, amount: number, allowOverhealBlock = false) {
  if (isPlayerDefeated(state)) return { state, effective: 0, restored: 0, overflow: 0 };
  amount = effectivePlayerHealingAmount(state, amount);
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const actualHeal = playerHealth - state.playerHealth;
  const overheal = state.playerHealth + amount - playerHealth;
  let nextState = Object.is(playerHealth, state.playerHealth) ? state : { ...state, playerHealth };
  if (actualHeal > 0 && nextState.trinketEffects.grovesFavorThornsOnHealthRestore > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        thorns: nextState.playerStatuses.thorns + nextState.trinketEffects.grovesFavorThornsOnHealthRestore,
      },
    };
  }
  if (allowOverhealBlock && overheal > 0 && nextState.talentEffects.overhealToBlockRatio > 0) {
    const blockGain = Math.round(overheal * nextState.talentEffects.overhealToBlockRatio);
    nextState = addPlayerStatus(nextState, "block", blockAmountWithForge(nextState, blockGain));
  }
  return { state: nextState, effective: amount, restored: actualHeal, overflow: overheal };
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}
