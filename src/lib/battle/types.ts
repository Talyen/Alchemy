import type { BattleCard, BestiaryEntry, DamageType, EnemyAttackEffect, EnemyStatusId, PlayerStatusId } from "@/lib/game-data";

// Baseline balance knobs — tuned so the Knight starter deck (8 cards, 8 turns avg per fight)
// can consistently beat the first enemy with some health remaining. Scaling per room
// increments these via draw.ts.
export const cardsPerTurn = 4;
export const maxHandSize = 7;
export const maxPlayerHealth = 30;
export const baseEnemyHealth = 30;
export const baseEnemyAttack = 8;
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

// Pre-computed bonuses from unlocked talents, recalculated each battle start.
// We pass these as flat numbers rather than raw talent IDs to keep the battle
// engine decoupled from the talent-pool data shape.
export type TalentEffectManifest = {
  // --- Physical ---
  flatPhysicalDamage: number;   // +X to all physical damage
  armorToPhysicalDamage: boolean; // adds current armor value to physical damage
  physicalCritChance: number;   // additional crit % for physical (on top of global 5%)
  firstPhysicalCardFree: boolean;
  physicalVsStunnedMultiplier: number; // percent bonus when enemy is stunned
  physicalVsFrozenMultiplier: number;  // percent bonus when enemy is frozen

  // --- Stun ---
  stunThresholdReduction: number; // fraction subtracted from base 0.5 threshold
  drawOnStun: number;             // cards drawn when stunning an enemy
  nextCardFreeOnStun: boolean;    // next card costs 0 after stunning

  // --- Block ---
  startBlock: number;
  blockToPhysicalDamage: boolean; // add floor(block/2) to physical damage
  blockPreventsBleed: boolean;
  blockPreventsPoison: boolean;
  blockPreventsStun: boolean;
  blockAbsorbPhysicalBonus: number; // percent more damage block absorbs from physical attacks

  // --- Forge ---
  forgeToBurn: boolean;
  forgeToHoly: boolean;
  forgeToBlock: boolean;
  forgeBurnThreshold: number; // forge count that triggers burn burst
  forgeBurnDamage: number;    // burn burst damage amount

  // --- Armor ---
  armorAilmentReduction: number; // flat reduction to player ailment tick damage
  armorBlockThreshold: number;   // armor count that triggers block burst
  armorBlockAmount: number;      // block burst amount
  armorDoubledBelowHalfHealth: boolean;
  firstArmorCardDoubled: boolean;

  // --- Health ---
  campfireHealBonus: number; // fraction added to base campfire heal (e.g. 0.1 = +10%)
  healthThresholdBlock: { threshold: number; amount: number } | null; // gain block when health drops below threshold
  maxHealthPerCombat: number; // max health gained after each combat
  startHealth: number;         // bonus health at start of combat
  healMultiplier: number;      // multiplier for all healing (e.g. 1.1 = +10%)
  healthThresholdArmor: { threshold: number; amount: number } | null; // gain armor when health drops below threshold

  // --- Burn ---
  firstBurnCardDoubled: boolean;
  burnRemovesEnemyArmor: boolean;
  burnDoubleChance: number; // percent chance burn stack doubles instead of halving on tick
  receiveHalfBurnDamage: boolean;

  // --- Gold ---
  shopCardDiscount: number;
  shopFreeRefresh: boolean;
  startGold: number;
  goldPerCombat: number;
  potionDiscount: number;
  removeCardDiscount: number;
  enemyGoldDropBonus: number; // fraction bonus to gold drops (e.g. 0.1 = +10%)
  goldOnWish: number;
  mixPotionDiscount: number;

  // --- Holy ---
  holyLifestealPercent: number; // percent of holy damage healed (e.g. 10 = 10%)
  firstHolyCardFree: boolean;
  holyGoldPercent: number;      // holy damage increased by this percent of current gold
  holyBurnChance: number;       // percent chance holy damage applies burn
  receiveHalfHolyDamage: boolean;
  holyBlockPercent: number;     // holy damage increased by this percent of current block
  holyWishChance: number;       // percent chance holy damage triggers wish
  holyBlockPercentFromDamage: number; // block granted equal to this percent of holy damage dealt
  holyVsBurnMultiplier: number; // percent bonus when enemy has burn

  // --- Wish ---
  goldOnWishAmount: number;
  wishUndiscoveredCards: boolean;
  healthOnWish: number;
  removeAilmentOnWish: boolean;
  wishExtraChoiceChance: number; // percent chance to offer an extra card choice
  wishDrawsCard: boolean;

  // --- Poison ---
  firstPoisonCardFree: boolean;
  poisonPhysicalBonus: number; // +X physical damage against poisoned enemies
  poisonGainChance: number;    // percent chance poison gains a stack instead of losing on tick
  receiveHalfPoisonDamage: boolean;
  goldOnFirstPoison: number;
  poisonHalvesHealing: boolean;

  // --- Bleed ---
  firstBleedCardFree: boolean;
  bleedPhysicalBonus: number;        // +X physical damage against bleeding enemies
  bleedLeechChance: number;          // percent chance bleed applies lifesteal
  bleedEnemyDamageReduction: number; // enemies with bleed deal X less damage
  bleedPhysicalTakenBonus: number;   // +X physical damage against bleeding enemies (stacks with bleedPhysicalBonus)
  bleedExecuteThreshold: number;     // percent HP threshold for bleed execute bonus
  bleedDesperateMultiplier: number;  // multiplier when player is below 50% health
  bleedPoisonChance: number;         // percent chance bleed also applies poison
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
  enemyHealth: number;
  enemyMaxHealth: number;        // stored so UI can render % even after damage
  enemyAttackEffects: EnemyAttackEffect[]; // scaled per room, applied during enemy phase
  enemyRegeneration: number;       // health restored at end of each enemy turn
  enemyArmor: number;             // flat damage reduction for the enemy
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  enemyStunSkipTurns: number;     // turns skipped from stun triggers
  enemyFreezeSkipTurns: number;   // turns skipped from freeze triggers
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  flags: CombatFlags;
  discoveredCardIds: string[];    // used by wish undiscovered talent
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

// Factory defaults — all statuses start at 0. The 9 player statuses include
// block/armor/forge/haste (offensive/defensive buffs) plus the 5 DoT ailments
// that overlap with enemy statuses.
