// Type contracts for the immutable battle engine — BattleState shape, manifests, flags.
// Depends only on game-data shape types and is imported by draw, effects, turns, and UI.
// Keep these state shapes explicit so save/load, animation, and combat stay in sync.
// Runtime health helpers live in ./health; this file is pure types + re-exports.
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

// Both player and enemy use status ID unions, but enemies never gain
// block/armor/forge/haste — those are filtered out at the BattleCardEffect level.
export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number>;

export type TurnPhase = "player" | "enemy";

// Pre-computed bonuses from trinkets acquired during the run. Follows the same
// pattern as TalentEffectManifest — computed once at battle start, immutable for
// the duration of the battle.
export type TrinketManifest = {
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

// Re-exported from game-data/types.ts so @/lib/battle barrel consumers still find it.
export type { TalentEffectManifest } from "@/lib/game-data";

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
  firstBurnTrinketDoubledUsed: boolean;
  firstHarmfulStatusPrevented: boolean;
  firstPotionFreeUsed: boolean;
  resonantChimeUsedThisTurn: boolean;
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
  deathsDoorTriggeredTurn: number | null; // enemy-turn marker so the grace window lasts one full player turn
  enemyHealth: number;
  enemyMaxHealth: number; // stored so UI can render % even after damage
  enemyAttackEffects: EnemyAttackEffect[]; // scaled per room, applied during enemy phase
  enemyRegeneration: number; // health restored at end of each enemy turn
  enemyArmor: number; // flat damage reduction for the enemy
  enemyForge: number; // bonus physical damage added per stack (rusting-carapace)
  enemyFreezeBonus: number; // per-turn freeze status bonus (glacial-shell)
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  pendingBleedLeechHealing: number; // internal bleed-lifesteal healing due when bleed ticks
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
  trinketEffects: TrinketManifest;
  flags: CombatFlags;
  discoveredCardIds: string[]; // used by wish undiscovered talent
  cardsPlayedThisTurn: number;
  nextCardUid: number; // battle-owned source for unique rendered card keys
  difficultyModifiers: DifficultyModifier[];
};

// Combat texts are emitted by battle functions and consumed by the floating-text
// animation system. They're merged by (target, kind, stat) so rapid-fire damage
// from multi-hit cards shows "-5" instead of "-2 -3".
export type CombatTextTarget = "player" | "enemy";
export type CombatTextKind = "damage" | "heal" | "status" | "notice";
export type CombatTextStat = DamageType | PlayerStatusId | EnemyStatusId | "health" | "mana" | "gold";

export type NumericCombatTextEvent = {
  target: CombatTextTarget;
  kind: Exclude<CombatTextKind, "notice">;
  stat: CombatTextStat;
  amount: number;
};

export type NoticeCombatTextEvent = {
  target: CombatTextTarget;
  kind: "notice";
  stat: Extract<CombatTextStat, "freeze" | "stun">;
  text: "Frozen" | "Stunned";
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

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  const adjustedDelta = isNullFieldActive(state) ? Math.max(1, Math.round(delta / 2)) : delta;
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + adjustedDelta } };
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: value } };
}

export function addGold(state: BattleState, delta: number): BattleState {
  return { ...state, gold: state.gold + delta };
}

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

export function clampHealth(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

export function applyPlayerCombatDamage(state: BattleState, damage: number): BattleState {
  if (damage <= 0) return state;
  const nextHealth = clampHealth(state.playerHealth, -damage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (!state.deathsDoorUsed) {
    return {
      ...state,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
    };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: state.deathsDoorActive };
}

export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  return { ...state, playerHealth, deathsDoorActive: playerHealth <= 0 && state.deathsDoorActive };
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}

// Derives null-field status from difficulty modifiers rather than storing it
// as a separate field, preventing desync between the flag and modifier array.
export function isNullFieldActive(state: Pick<BattleState, "difficultyModifiers">): boolean {
  return state.difficultyModifiers.some((m) => m.kind === "labyrinth-null-field");
}
