// Type contracts for the immutable battle engine — BattleState shape, manifests, flags.
// Depends only on game-data shape types and is imported by draw, effects, turns, and UI.
// Keep these state shapes explicit so save/load, animation, and combat stay in sync.
// Runtime health helpers live in ./health; this file is pure types + re-exports.
import type { BattleCard, BestiaryEntry, CompanionDefinition, DamageType, DifficultyModifier, EnemyAttackEffect, EnemyStatusId, PlayerStatusId, TalentEffectManifest } from "@/lib/game-data";

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
  enemyFreezeBonus: number;       // per-turn freeze status bonus (glacial-shell)
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  enemyStunSkipTurns: number;     // turns skipped from stun triggers
  enemyFreezeSkipTurns: number;   // turns skipped from freeze triggers
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  wishQueue: BattleCard[][];        // additional Wish selections waiting behind the active modal
  activeCompanion: CompanionDefinition | null; // persistent ally effect for this battle only
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  trinketEffects: TrinketManifest;
  flags: CombatFlags;
  discoveredCardIds: string[];    // used by wish undiscovered talent
  cardsPlayedThisTurn: number;
  nextCardUid: number;             // battle-owned source for unique rendered card keys
  difficultyModifiers: DifficultyModifier[];
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

export { clampHealth, applyPlayerCombatDamage, applyPlayerHealing, isPlayerDefeated } from "./health";

