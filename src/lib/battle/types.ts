import type { BattleCard, BestiaryEntry, DamageType, EnemyStatusId, PlayerStatusId } from "@/lib/game-data";

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
  flatPhysicalDamage: number;   // +X to all physical damage
  armorToPhysicalDamage: boolean; // adds current armor value to physical damage
  physicalCritChance: number;   // additional crit % for physical (on top of global 5%)
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
  enemyHealth: number;
  enemyMaxHealth: number;        // stored so UI can render % even after damage
  enemyAttack: number;            // scaled per room, applied during enemy phase
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  enemySkipTurns: number;         // set by stun/freeze when threshold is met
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
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

// Factory defaults — all statuses start at 0. The 9 player statuses include
// block/armor/forge/haste (offensive/defensive buffs) plus the 5 DoT ailments
// that overlap with enemy statuses.

