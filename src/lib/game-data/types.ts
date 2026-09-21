import type { output } from "zod";
import type { TEMPLATE_EFFECT_DEFINITIONS } from "./effects/registry";
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
  | "dodge"
  | "thorns";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "nature";

export const DAMAGE_TYPES = ["physical", "stun", "holy", "burn", "poison", "bleed", "freeze", "nature"] as const;

export type PlayerStatusId =
  | "block"
  | "armor"
  | "thorns"
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
  | "thorns"
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

// Ordinary effect fields derive from validation; recursive edges remain explicit.
// Preserve exact optional properties for authored effects (Zod permits undefined).
type AuthoredEffect<T> = T extends unknown ? { [K in keyof T]: Exclude<T[K], undefined> } : never;
type TemplateEffect = AuthoredEffect<output<(typeof TEMPLATE_EFFECT_DEFINITIONS)[number]["schema"]>>;
export type BattleCardEffect =
  | TemplateEffect
  | { kind: "chance"; probability: number; successEffects: BattleCardEffect[]; failureEffects: BattleCardEffect[] }
  | { kind: "repeat-over-turns"; remainingTurns: number; effects: BattleCardEffect[] };

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
  abilityIds: string[];
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

export const beneficialPlayerStatusIds: PlayerStatusId[] = [
  "block",
  "armor",
  "thorns",
  "forge",
  "haste",
  "phoenixFeather",
];

export const PLAYER_STATUS_DISPLAY_ORDER: readonly PlayerStatusId[] = [
  "block",
  "armor",
  "thorns",
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
  "thorns",
  "onAttackBleed",
];
