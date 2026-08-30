import type { TrinketManifest } from "./trinket-manifest";

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
  | "phoenixFeather"
  | "dodge";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "nature";

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

export type EnemyStatusId =
  | "burn"
  | "poison"
  | "bleed"
  | "freeze"
  | "stun"
  | "burnBonus"
  | "freezeBonus"
  | "onAttackBleed";

export type EnemyStatusDamageId = Exclude<EnemyStatusId, "burnBonus" | "freezeBonus" | "onAttackBleed">;

export type CompanionId =
  | "wolf"
  | "lizard-scout"
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
      doubleIfEnemyBurning?: boolean;
      tripleIfEnemyNotBurning?: boolean;
    }
  | {
      kind: "player-status";
      status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste" | "phoenixFeather">;
      amount: number;
      perManaCrystal?: number;
      convertCurrentMana?: number;
    }
  | { kind: "enemy-status"; status: EnemyStatusId; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number; ifEnemyFrozen?: boolean }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-harmful-status"; amount: number; removeAll?: boolean }
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
  | { kind: "play-next-card-twice" }
  | { kind: "next-hit-poison" };

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

  corruptedValuePositions?: Array<{ lineIndex: number; matchIndex: number }>;
  baseTitle?: string;

  tags?: KeywordId[];
  effects: BattleCardEffect[];
  excludeFromOfferPool?: boolean;
}

export const ENEMY_TYPES = {
  NORMAL: "normal",
  ELITE: "elite",
  BOSS: "boss",
} as const;

export const ENEMY_TYPE_VALUES = [ENEMY_TYPES.NORMAL, ENEMY_TYPES.ELITE, ENEMY_TYPES.BOSS] as const;

export type EnemyType = (typeof ENEMY_TYPE_VALUES)[number];

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
  effects: Partial<TrinketManifest>;
}

export interface KeywordDefinition {
  id: KeywordId;
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  shineColors: string[];

  pillBgClass?: string;
}

export const harmfulPlayerStatusIds: PlayerStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];

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

export const ENEMY_STATUS_DISPLAY_ORDER: readonly EnemyStatusId[] = [
  "burnBonus",
  "freezeBonus",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
  "onAttackBleed",
];
