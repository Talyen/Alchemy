import { clamp } from "@/lib/math";
import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION, DEATHS_DOOR_GRACE_TURNS, PERCENT_DENOMINATOR } from "../../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { halveRounded } from "../amount-helpers";
import type { BattleState, CombatFlags, CombatTextEvent, EnemyMitigation } from "./state-types";
import { isStunFreezeBuildupBlocked } from "./state-types";
import { PRESERVED_FLAG_KEYS, PRESERVED_FLAG_VALUES, type PreservedFlagKey } from "../combat-flags";

export function withPreservedFlags(state: BattleState, mutate: (s: BattleState) => BattleState): BattleState {
  const saved: Partial<Pick<CombatFlags, PreservedFlagKey>> = {};
  for (const key of PRESERVED_FLAG_KEYS) {
    saved[key] = state.flags[key] as never;
  }
  const blockedState: BattleState = {
    ...state,
    flags: { ...state.flags, ...PRESERVED_FLAG_VALUES },
  };
  const result = mutate(blockedState);
  return { ...result, flags: { ...result.flags, ...saved } };
}

export function playerStatusDelta(state: BattleState, status: PlayerStatusId, delta: number): number {
  return status === "block" && delta > 0 ? delta + state.gearEffects.flatBlockGained : delta;
}

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.playerCC)) {
    return state;
  }
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      [status]: state.playerStatuses[status] + playerStatusDelta(state, status, delta),
    },
  };
}

export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: value } };
}

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.enemyCC)) {
    return state;
  }
  const traitAdjustedDelta =
    status === "stun" && state.currentEnemy.traits.some((trait) => trait.id === "braced") ? halveRounded(delta) : delta;
  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + traitAdjustedDelta },
  };

  if (
    status === "poison" &&
    traitAdjustedDelta > 0 &&
    rollPercent(nextState.gearEffects.poisonArmorShredChance, getBattleRng(nextState))
  ) {
    nextState = reduceEnemyArmor(nextState, 1);
  }

  return nextState;
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: value } };
}

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  if (traitSet) return traitSet.has(traitId);
  return state.currentEnemy.traits.some((trait) => trait.id === traitId);
}

export function getEnemyTraitSet(state: BattleState): ReadonlySet<string> {
  return new Set(state.currentEnemy.traits.map((trait) => trait.id));
}

export function addEnemyMitigation(state: BattleState, field: keyof EnemyMitigation, delta: number): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      [field]: state.enemyMitigation[field] + delta,
    },
  };
}

export function stripEnemyArmor(state: BattleState): BattleState {
  if (state.enemyMitigation.armor <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } };
}

export function stripEnemyBlock(state: BattleState): BattleState {
  if (state.enemyMitigation.block <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, block: 0 } };
}

export function reduceEnemyArmor(state: BattleState, delta: number): BattleState {
  if (delta <= 0 || state.enemyMitigation.armor <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - delta),
    },
  };
}

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

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
}

export function damageEnemyHealth(state: BattleState, damage: number): EnemyHitHealth {
  const previousHealth = state.enemyHealth;
  return {
    state: { ...state, enemyHealth: clampHealth(state.enemyHealth, -damage, state.enemyMaxHealth) },
    previousHealth,
    enemyWasAlive: previousHealth > 0,
  };
}

export function gainMana(state: BattleState, amount: number): BattleState {
  if (amount <= 0) return state;
  return { ...state, mana: Math.min(state.maxMana, state.mana + amount) };
}

function computeDamageReduction(damage: number, damageType: string | undefined, state: BattleState): number {
  if (damageType === "burn") return damage - state.talentEffects.burnDamageReduction;
  if (damageType === "freeze") return damage - state.talentEffects.freezeDamageReduction;
  if (damageType === "nature") return damage - state.talentEffects.natureDamageReduction;
  if (damageType === "poison") return damage - state.talentEffects.poisonDamageReduction;
  return damage;
}

export function scaleReceivedPlayerDamage(
  damage: number,
  talentEffects: BattleState["talentEffects"],
  damageType: string | undefined,
): number {
  if (damage <= 0) return damage;
  const receiveHalf =
    (damageType === "burn" && talentEffects.receiveHalfBurnDamage) ||
    (damageType === "holy" && talentEffects.receiveHalfHolyDamage) ||
    (damageType === "freeze" && talentEffects.receiveHalfFreezeDamage) ||
    (damageType === "poison" && talentEffects.receiveHalfPoisonDamage) ||
    (damageType === "bleed" && talentEffects.receiveHalfBleedDamage) ||
    (damageType === "nature" && talentEffects.receiveHalfNatureDamage);
  return receiveHalf ? halveRounded(damage) : damage;
}

export function deathsDoorGraceTurns(extension: number): number {
  return DEATHS_DOOR_GRACE_TURNS + Math.max(0, extension);
}

export interface EnemyTraitIgnoreMitigationOptions {
  ignoreMitigation?: boolean;
}

export function applyPlayerCombatDamage(
  state: BattleState,
  damage: number,
  damageType?: string,
  options?: EnemyTraitIgnoreMitigationOptions,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (!Number.isFinite(damage) || damage <= 0) return state;
  let reducedDamage = damage;
  if (!options?.ignoreMitigation) {
    reducedDamage -= state.talentEffects.damageReduction;
    if (state.activeCompanion && state.talentEffects.damageReductionWithCompanion > 0) {
      reducedDamage -= state.talentEffects.damageReductionWithCompanion;
    }
    reducedDamage = computeDamageReduction(reducedDamage, damageType, state);
    reducedDamage = Math.max(0, reducedDamage);
    reducedDamage = applyGearDamageResistance(reducedDamage, damageType, state.gearEffects);
  }
  const nextHealth = clampHealth(state.playerHealth, -reducedDamage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (state.playerStatuses.phoenixFeather > 0) {
    const healAmount = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
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
    };
  }
  if (state.deathsDoorActive) {
    if (state.playerHealth === 1 && reducedDamage > 0) {
      combatTexts?.push({ target: "player", kind: "notice", stat: "deathsDoor", text: "" });
    }
    return { ...state, playerHealth: 1 };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: false };
}

export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const overheal = state.playerHealth + amount - playerHealth;
  let nextState = {
    ...state,
    playerHealth,
  };
  if (overheal > 0 && nextState.talentEffects.overhealToBlockRatio > 0) {
    const blockGain = Math.round(overheal * nextState.talentEffects.overhealToBlockRatio);
    nextState = addPlayerStatus(nextState, "block", blockGain);
  }
  return nextState;
}

export function applyGearDamageResistance(
  damage: number,
  damageType: string | undefined,
  gear: GearEffectManifest,
): number {
  const RESIST_BY_DAMAGE_TYPE: Record<string, keyof GearEffectManifest> = {
    physical: "resistPhysical",
    stun: "resistStun",
    holy: "resistHoly",
    burn: "resistBurn",
    poison: "resistPoison",
    bleed: "resistBleed",
    freeze: "resistFreeze",
    nature: "resistNature",
  };
  const key = damageType ? RESIST_BY_DAMAGE_TYPE[damageType] : undefined;
  const resist = key ? gear[key] : 0;
  if (resist <= 0) return damage;
  return Math.max(0, Math.round(damage * (1 - resist / PERCENT_DENOMINATOR)));
}

export function scaleGoldReward(baseGold: number, gear: GearEffectManifest): number {
  if (gear.goldGainPercent <= 0) return baseGold;
  return Math.round(baseGold * (1 + gear.goldGainPercent / PERCENT_DENOMINATOR));
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}
