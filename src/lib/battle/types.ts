/**
 * Defines core types, immutable BattleState structures, and state-updating helpers.
 * Depends on: @/lib/game-data.
 * Depended on by: all modules in the battle subsystem, features/alchemy controllers/UI.
 */

import type {
  BattleCard,
  BestiaryEntry,
  CompanionDefinition,
  DamageType,
  DifficultyModifier,
  EnemyAttackEffect,
  EnemyStatusId,
  PlayerStatusId,
  TalentEffectManifest,
} from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION } from "../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";

// Both player and enemy use status ID unions, but enemies never gain
// block/armor/forge/haste — those are filtered out at the BattleCardEffect level.
export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number>;

export type TurnPhase = "player" | "enemy";

// Enemy mitigation lives outside enemyStatuses: armor reduces incoming damage,
// forge adds physical attack bonus (decays per hit), freezeBonus adds freeze stacks from attacks.
export type EnemyMitigation = {
  armor: number;
  forge: number;
  freezeBonus: number;
  burnBonus: number;
  block: number;
};

export const EMPTY_ENEMY_MITIGATION: EnemyMitigation = { armor: 0, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 };

// Pre-computed bonuses from boons acquired during the run. Follows the same
// pattern as TalentEffectManifest — computed once at battle start, immutable for
// the duration of the battle.
export type BoonManifest = {
  extraDrawPerBattle: number;
  firstHolyDamageDoubled: boolean;
  firstBurnDoubled: boolean;
  boneCharmHealOnKill: number;
  forgeStunThreshold: number;
  forgeStunAmount: number;
  frozenHeartDamage: number;
  blockToArmorThreshold: number;
  blockToArmorAmount: number;
  runicQuillDrawOnConsume: number;
  sinEaterHealOnHarmfulStatusRemove: number;
  vanguardCrestForgeOnBlockAbsorb: number;
  parasiticBloomLeechChance: number;
  cutpurseGoldOnBleed: number;
  wishingWellGoldOnWish: number;
  plagueDoctorImmunity: boolean;
  mortarPestleFreeFirstPotion: boolean;
  sunderingArmorPiercing: number;
  resonantChimeCardsRequired: number;
  resonantChimeMana: number;
  smugglersMapGoldBonus: number;
  grovesFavorStartHeal: number;
  merchantsFavorDiscount: number;
  companionDamageBonus: number;
  freezeDurationExtension: number;
  thunderstoneDamageOnStun: number;
  luckyCloverGoldChance: number;
};

// Threshold-driven combat flags that reset each battle.
export type CombatFlags = {
  firstPhysicalCardFreeUsed: boolean;
  firstHolyCardFreeUsed: boolean;
  firstBurnCardDoubledUsed: boolean;
  firstArmorCardDoubledUsed: boolean;
  firstPoisonCardFreeUsed: boolean;
  firstBleedCardFreeUsed: boolean;
  nextCardCostReduction: number; // temporary mana discount on next card played
  goldOnFirstPoisonThisCombat: boolean;
  firstHolyDamageBonusUsed: boolean;
  firstBurnBoonDoubledUsed: boolean;
  firstHarmfulStatusPrevented: boolean;
  firstPotionFreeUsed: boolean;
  firstLeechCardDoubledUsed: boolean;
  resonantChimeUsedThisTurn: boolean;
  runicQuillUsedThisTurn: boolean;
  divineAegisTriggered: boolean;
};

// The full snapshot of a battle at one point in time. Every mutation returns a new
// BattleState (immutable), enabling the controller to diff states for animation.
export type BattleState = {
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhausted: BattleCard[]; // consumed cards removed for the battle
  mana: number;
  maxMana: number;
  gold: number;
  turn: number;
  turnPhase: TurnPhase;
  playerHealth: number;
  playerMaxHealth: number; // current max health (can increase from talents)
  deathsDoorUsed: boolean; // one-shot combat survival trigger for this battle
  deathsDoorActive: boolean; // true while the player has one turn to heal from 0 Health
  deathsDoorTriggeredTurn: number | null; // stores player turn when Death's Door first triggered
  deathsDoorGraceTurnsRemaining: number | null; // stores grace turns remaining when Death's Door triggers
  enemyHealth: number;
  enemyMaxHealth: number; // stored so UI can render % even after damage
  enemyAttackEffects: EnemyAttackEffect[]; // scaled per room, applied during enemy phase
  enemyRegeneration: number; // health restored at end of each enemy turn
  roomScalingMultiplier: number; // room scaling factor applied to trait values and regen
  enemyMitigation: EnemyMitigation;
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  pendingBleedLeechHealing: number; // bleed leech queued here on damage, paid out in tickBleed — prevents double-dipping if enemy dies before bleed ticks
  pendingEnemyBleedLeechHealing: number;
  enemyPhysicalDamageBonus: number;
  enemyStunSkipTurns: number; // turns skipped from stun triggers
  enemyFreezeSkipTurns: number; // turns skipped from freeze triggers
  playerStunSkipTurns: number; // player turns skipped from stun
  playerFreezeSkipTurns: number; // player turns skipped from freeze
  playerCCCooldown: number; // turns of CC immunity after being stunned or frozen
  enemyCCCooldown: number; // turns of CC immunity for the enemy after being stunned or frozen
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  wishQueue: BattleCard[][]; // additional Wish selections waiting behind the active modal
  activeCompanion: CompanionDefinition | null; // persistent ally effect for this battle only
  companionDamageBuff: number; // persistent buff from Pack Tactics-style cards
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  boonEffects: BoonManifest;
  gearEffects: GearEffectManifest;
  flags: CombatFlags;
  discoveredCardIds: string[]; // used by wish undiscovered talent
  cardsPlayedThisTurn: number;
  nextCardUid: number; // battle-owned source for unique rendered card keys
  difficultyModifiers: DifficultyModifier[];
  rng: () => number;
  pendingMaterials: MaterialInventory;
};

// Combat texts are emitted by battle functions and consumed by the floating-text
// animation system. They're merged by (target, kind, stat) so rapid-fire damage
// from multi-hit cards shows "-5" instead of "-2 -3".
export type CombatTextTarget = "player" | "enemy";
export type CombatTextKind = "damage" | "heal" | "status" | "multiply" | "notice";
export type CombatTextStat = DamageType | PlayerStatusId | EnemyStatusId | "health" | "mana" | "gold" | "crystal";

export type NumericCombatTextEvent = {
  target: CombatTextTarget;
  kind: Exclude<CombatTextKind, "notice">;
  stat: CombatTextStat;
  amount: number;
};

export type NoticeCombatTextEvent = {
  target: CombatTextTarget;
  kind: "notice";
  stat: CombatTextStat;
  text: string;
};

export type CombatTextEvent = NumericCombatTextEvent | NoticeCombatTextEvent;

export type BattleResolution = {
  state: BattleState;
  combatTexts: CombatTextEvent[];
};

// Immutable update helpers for BattleState. Replaces the error-prone nested spread
// pattern used ~25 times across the battle engine with one-line focused updaters.

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: state.playerStatuses[status] + delta } };
}

export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: value } };
}

export function adjustEnemyStatusDelta(state: Pick<BattleState, "difficultyModifiers">, delta: number): number {
  void state;
  return delta;
}

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  const traitAdjustedDelta =
    status === "stun" && state.currentEnemy.traits.some((trait) => trait.id === "braced")
      ? Math.round(delta / 2)
      : delta;
  const adjustedDelta = adjustEnemyStatusDelta(state, traitAdjustedDelta);
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + adjustedDelta } };
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: value } };
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

export function addGold(state: BattleState, delta: number): BattleState {
  return { ...state, gold: state.gold + delta };
}

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

// Adds delta (positive or negative) to current, clamped to [0, max]. NOT an absolute setter.
export function clampHealth(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

// Death's Door triggers once per battle. Subsequent zero-health hits maintain state without extra grace.
// damageReduction subtracts flat damage (e.g., from talents) before applying to health.
export function applyPlayerCombatDamage(state: BattleState, damage: number, damageType?: string): BattleState {
  if (damage <= 0) return state;
  let reducedDamage = damage - (state.talentEffects.damageReduction ?? 0);
  if (damageType === "burn") {
    reducedDamage -= state.talentEffects.burnDamageReduction ?? 0;
  } else if (damageType === "freeze") {
    reducedDamage -= state.talentEffects.freezeDamageReduction ?? 0;
  } else if (damageType === "nature") {
    reducedDamage -= state.talentEffects.natureDamageReduction ?? 0;
  }
  reducedDamage = Math.max(0, reducedDamage);
  const nextHealth = clampHealth(state.playerHealth, -reducedDamage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (state.playerStatuses.phoenixFeather > 0) {
    const healAmount = Math.ceil(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
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
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
      deathsDoorGraceTurnsRemaining: 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0),
    };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: state.deathsDoorActive };
}

// Healing at 0 HP with Death's Door active removes protection (deathsDoorActive flips to false
// via the `health > 0` path of the expression) — healing saves you but costs the grace window.
export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const overheal = state.playerHealth + amount - playerHealth;
  let nextState = {
    ...state,
    playerHealth,
    deathsDoorActive: playerHealth <= 0 && state.deathsDoorActive,
    deathsDoorTriggeredTurn: playerHealth <= 0 ? state.deathsDoorTriggeredTurn : null,
    deathsDoorGraceTurnsRemaining: playerHealth <= 0 ? state.deathsDoorGraceTurnsRemaining : null,
  };
  if (overheal > 0 && (nextState.talentEffects.overhealToBlockRatio ?? 0) > 0) {
    const blockGain = Math.round(overheal * nextState.talentEffects.overhealToBlockRatio);
    nextState = addPlayerStatus(nextState, "block", blockGain);
  }
  return nextState;
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}
