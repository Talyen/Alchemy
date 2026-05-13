// Type contracts and tiny clamp helpers for the immutable battle engine.
// Depends only on game-data shape types and is imported by draw, effects, turns, and UI.
// Keep these state shapes explicit so save/load, animation, and combat stay in sync.
import type { BattleCard, BestiaryEntry, CompanionDefinition, DamageType, EnemyAttackEffect, EnemyStatusId, PlayerStatusId, TalentEffectManifest } from "@/lib/game-data";

// Baseline balance knobs — tuned so the Knight starter deck (8 cards, 8 turns avg per fight)
// can consistently beat the first enemy with some health remaining. Scaling per room
// increments these via draw.ts.
export const cardsPerTurn = 4;
export const maxHandSize = 7;
export const maxPlayerHealth = 30;
export const baseEnemyHealth = 30;
export const basePlayerMana = 4;

// Both player and enemy use the same status ID union, but enemies never gain
// block/armor/forge/haste — those are filtered out at the BattleCardEffect level.
// bleedLeech is a separate counter so bleed-lifesteal can track how much to heal
// without mixing into the bleed-damage stack.
export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number> & {
  bleedLeech: number;
};

export type TurnPhase = "player" | "enemy";

// Pre-computed bonuses from trinkets acquired during the run. Follows the same
// pattern as TalentEffectManifest — computed once at battle start, immutable for
// the duration of the battle.
export type TrinketManifest = {
  extraDrawPerBattle: number;
  firstHolyDamageBonus: number;
  firstBurnDoubled: boolean;
  boneCharmHealOnKill: number;
  forgeStunThreshold: number;
  forgeStunAmount: number;
  frozenHeartDamage: number;
  blockToArmorThreshold: number;
  blockToArmorAmount: number;
  runicQuillDrawOnConsume: number;
  sinEaterGoldOnAilmentRemove: number;
  vanguardCrestForgeOnBlockAbsorb: number;
  parasiticBloomHealPerPoisonTick: number;
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
};

// TalentEffectManifest moved to game-data/types.ts to resolve cross-layer dependency.
// Re-exported here so existing barrel consumers still find it at @/lib/battle.
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
  firstAilmentPrevented: boolean;
  firstPotionFreeUsed: boolean;
  boneCharmUsed: boolean;
  resonantChimeUsedThisTurn: boolean;
};

// The full snapshot of a battle at one point in time. Every mutation returns a new
// BattleState (immutable), enabling the controller to diff states for animation.
export type BattleState = {
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhausted: BattleCard[];       // consumed cards removed for the battle
  mana: number;
  maxMana: number;
  gold: number;
  turn: number;
  turnPhase: TurnPhase;
  playerHealth: number;
  playerMaxHealth: number;       // current max health (can increase from talents)
  deathsDoorUsed: boolean;       // one-shot combat survival trigger for this battle
  deathsDoorActive: boolean;     // true while the player has one turn to heal from 0 HP
  deathsDoorTriggeredTurn: number | null; // enemy-turn marker so the grace window lasts one full player turn
  enemyHealth: number;
  enemyMaxHealth: number;        // stored so UI can render % even after damage
  enemyAttackEffects: EnemyAttackEffect[]; // scaled per room, applied during enemy phase
  enemyRegeneration: number;       // health restored at end of each enemy turn
  enemyArmor: number;             // flat damage reduction for the enemy
  enemyForge: number;             // bonus physical damage added per stack (rusting-carapace)
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  enemyStunSkipTurns: number;     // turns skipped from stun triggers
  enemyFreezeSkipTurns: number;   // turns skipped from freeze triggers
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  activeCompanion: CompanionDefinition | null; // persistent ally effect for this battle only
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  trinketEffects: TrinketManifest;
  flags: CombatFlags;
  discoveredCardIds: string[];    // used by wish undiscovered talent
  cardsPlayedThisTurn: number;
  nextCardUid: number;             // battle-owned source for unique rendered card keys
};

// Combat texts are emitted by battle functions and consumed by the floating-text
// animation system. They're merged by (target, kind, stat) so rapid-fire damage
// from multi-hit cards shows "-5" instead of "-2 -3".
export type CombatTextTarget = "player" | "enemy";
export type CombatTextKind = "damage" | "heal" | "status";
export type CombatTextStat = DamageType | PlayerStatusId | EnemyStatusId | "health" | "mana" | "gold";

export type CombatTextEvent = {
  target: CombatTextTarget;
  kind: CombatTextKind;
  stat: CombatTextStat;
  amount: number;
};

export type BattleResolution = {
  state: BattleState;
  combatTexts: CombatTextEvent[];
};

// Clamps a value between min and max. Used everywhere for health/mana bounds.
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Shortcut for health changes: health + delta, clamped to [0, max].
export function clampHealth(current: number, delta: number, max: number): number {
  return clamp(current + delta, 0, max);
}

// Combat damage at 0 HP gets one battle-scoped grace window instead of immediate defeat.
export function applyPlayerCombatDamage(state: BattleState, damage: number): BattleState {
  if (damage <= 0) return state;
  const nextHealth = clampHealth(state.playerHealth, -damage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (!state.deathsDoorUsed) {
    return { ...state, playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: state.turn };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: state.deathsDoorActive };
}

// Healing above 0 ends the warning window, but the one-shot trigger stays consumed.
export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  return { ...state, playerHealth, deathsDoorActive: playerHealth <= 0 && state.deathsDoorActive };
}

// Defeat checks use this so 0 HP can be survivable only during Death's Door.
export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}

