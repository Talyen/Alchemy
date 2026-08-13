// Core game-data type contracts shared across lib and features: card shapes, status IDs,
// enemy/trait/boon definitions. No runtime code — pure types only so other modules can import
// shapes without dragging in data or side effects.
export type KeywordId =
  | "physical"
  | "stun"
  | "block"
  | "forge"
  | "armor"
  | "health"
  | "burn"
  | "gold"
  | "holy"
  | "wish"
  | "consume"
  | "poison"
  | "bleed"
  | "leech"
  | "freeze"
  | "mana"
  | "nature"
  | "companion"
  | "archery"
  | "phoenixFeather";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "nature";

/** Damage types used for random-hit effects (e.g. Roulette). Archery is a card tag, not a damage type. */
export const DAMAGE_TYPES = ["physical", "stun", "holy", "burn", "poison", "bleed", "freeze", "nature"] as const;

export type PlayerStatusId =
  | "block"
  | "armor"
  | "forge"
  | "haste"
  | "phoenixFeather"
  | "burn"
  | "poison"
  | "bleed"
  | "freeze"
  | "stun";

export type EnemyStatusId = "burn" | "poison" | "bleed" | "freeze" | "stun" | "burnBonus" | "freezeBonus";
/** Enemy status IDs that represent actual damage types (excludes augments like burnBonus). */
export type EnemyStatusDamageId = Exclude<EnemyStatusId, "burnBonus" | "freezeBonus">;

export type CompanionId =
  | "wolf"
  | "lizard-scout"
  | "imp"
  | "frost-whelp"
  | "bear"
  | "panther"
  | "phoenix"
  | "skeleton"
  | "pixie"
  | "mana-moth"
  | "will-o-wisp"
  | "golden-retriever"
  | "shield-scarab"
  | "library-owl"
  | "fox";

export type EnemyAttackEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean }
  | { kind: "player-status"; status: PlayerStatusId; amount: number };

export interface EnemyTrait {
  id: string;
  title: string;
  description: string;
}

export type BattleCardEffect =
  | {
      kind: "damage";
      damageType: DamageType;
      amount: number;
      lifesteal?: boolean;
      equalToBlock?: boolean;
      equalToArmor?: boolean;
      equalToGoldPercent?: number;
    }
  | {
      kind: "player-status";
      status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste" | "phoenixFeather">;
      amount: number;
      perManaCrystal?: number;
    }
  | { kind: "enemy-status"; status: EnemyStatusDamageId; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-harmful-status"; amount: number }
  | { kind: "remove-player-status"; status: EnemyStatusDamageId }
  | { kind: "self-damage"; damageType: EnemyStatusDamageId; amount: number }
  | { kind: "buff-companion"; amount: number }
  | { kind: "lose-health"; amount: number }
  | { kind: "draw-cards"; amount: number }
  | { kind: "remove-enemy-armor"; amount: number }
  | { kind: "multiply-enemy-status"; status: EnemyStatusDamageId; factor: number }
  | {
      kind: "cleanse-player-status-to-damage";
      status: Extract<PlayerStatusId, "burn">;
      damageType: DamageType;
      removeAll?: boolean;
    }
  | { kind: "random-damage"; minAmount: number; maxAmount: number }
  | {
      kind: "chance";
      probability: number;
      successEffects: BattleCardEffect[];
      failureEffects: BattleCardEffect[];
    }
  | {
      kind: "repeat-over-turns";
      remainingTurns: number;
      effects: BattleCardEffect[];
    }
  | { kind: "next-hit-crit" }
  | { kind: "play-next-card-twice" };

export interface CompanionDefinition {
  id: CompanionId;
  title: string;
  art: string;
  turnStartEffects: BattleCardEffect[];
}

export interface BattleCard {
  id: string;
  uid?: number;
  title: string;
  descriptionLines: string[];
  art: string;
  cost: number;
  consume?: boolean;
  corrupted?: boolean;
  /** Positions of numeric values in descriptionLines that were modified by corruption, used to highlight them in the UI. */
  corruptedValuePositions?: Array<{ lineIndex: number; matchIndex: number }>;
  baseTitle?: string;
  /** Playstyle tags (e.g. archery) counted for talent XP; not damage types. */
  tags?: KeywordId[];
  effects: BattleCardEffect[];
  excludeFromOfferPool?: boolean;
}

export type EnemyType = "normal" | "elite" | "boss";

export interface BestiaryEntry {
  id: string;
  title: string;
  subtitle: string;
  descriptionLines: string[];
  art: string;
  enemyType: EnemyType;
  traits: EnemyTrait[];
  attackEffects: EnemyAttackEffect[];
}

export interface TrinketEntry {
  id: string;
  title: string;
  descriptionLines: string[];
  art: string;
}

export interface KeywordDefinition {
  id: KeywordId;
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  shineColors: string[];
  /** Translucent pill background for badges; must be a full Tailwind class string for JIT. */
  pillBgClass?: string;
  hidden?: boolean;
}

export const harmfulPlayerStatusIds: PlayerStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];

/** UI chip order — keep aligned with PlayerStatusId union. */
export const PLAYER_STATUS_DISPLAY_ORDER: readonly PlayerStatusId[] = [
  "block",
  "armor",
  "forge",
  "haste",
  "phoenixFeather",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
];

/** UI chip order — keep aligned with EnemyStatusId union. */
export const ENEMY_STATUS_DISPLAY_ORDER: readonly EnemyStatusId[] = [
  "burnBonus",
  "freezeBonus",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
];
