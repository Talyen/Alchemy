// Core game-data type contracts shared across lib and features: card shapes, status IDs,
// talent manifest, enemy/trait/trinket definitions. No runtime code — pure types only so other
// modules can import shapes without dragging in data or side effects.
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
  | "trap";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "nature";

export type PlayerStatusId = "block" | "armor" | "forge" | "haste" | "burn" | "poison" | "bleed" | "freeze" | "stun";

export type EnemyStatusId = "burn" | "poison" | "bleed" | "freeze" | "stun";

export type CompanionId = "wolf" | "lizard-scout" | "imp";

export type EnemyAttackEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean }
  | { kind: "player-status"; status: PlayerStatusId; amount: number };

export type EnemyTrait = {
  id: string;
  title: string;
  description: string;
};

export type BattleCardEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean; equalToBlock?: boolean; equalToArmor?: boolean }
  | { kind: "player-status"; status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste">; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-harmful-status"; amount: number }
  | { kind: "self-damage"; damageType: EnemyStatusId; amount: number }
  | { kind: "buff-companion"; amount: number };

export type CompanionDefinition = {
  id: CompanionId;
  title: string;
  art: string;
  turnStartEffects: BattleCardEffect[];
};

export type BattleCard = {
  id: string;
  uid?: number;
  title: string;
  descriptionLines: string[];
  art: string;
  cost: number;
  consume?: boolean;
  corrupted?: boolean;
  /** Positions of numeric values in descriptionLines that were modified by corruption, used to highlight them in the UI. */
  corruptedValuePositions?: { lineIndex: number; matchIndex: number }[];
  baseTitle?: string;
  effects: BattleCardEffect[];
};

export type EnemyType = "normal" | "elite" | "boss";

export type BestiaryEntry = {
  id: string;
  title: string;
  subtitle: string;
  descriptionLines: string[];
  art: string;
  enemyType: EnemyType;
  traits: EnemyTrait[];
  attackEffects: EnemyAttackEffect[];
};

export type TrinketEntry = {
  id: string;
  title: string;
  descriptionLines: string[];
  art: string;
};

export type KeywordDefinition = {
  id: KeywordId;
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  shineColors: string[];
  hidden?: boolean;
};

// Pre-computed bonuses from unlocked talents, recalculated each battle start.
// Lives in game-data because talents are game content; battle engine consumes the flat type.
export type TalentEffectManifest = {
  // --- Physical ---
  flatPhysicalDamage: number;
  armorToPhysicalDamage: boolean;
  physicalCritChance: number;
  firstPhysicalCardFree: boolean;
  physicalVsStunnedMultiplier: number;
  physicalVsFrozenMultiplier: number;

  // --- Stun ---
  stunThresholdReduction: number;
  drawOnStun: number;
  nextCardFreeOnStun: boolean;
  stunDurationExtension: number;
  stunDoubleDamage: boolean;

  // --- Block ---
  startBlock: number;
  blockToPhysicalDamage: boolean;
  blockPreventsBleed: boolean;
  blockPreventsPoison: boolean;
  blockPreventsStun: boolean;
  blockAbsorbPhysicalBonus: number;

  // --- Forge ---
  forgeToBurn: boolean;
  forgeToHoly: boolean;
  forgeToBlock: boolean;
  forgeBurnThreshold: number;
  forgeBurnDamage: number;

  // --- Armor ---
  armorMitigatesBurn: boolean;
  armorBlockThreshold: number;
  armorBlockAmount: number;
  armorDoubledBelowHalfHealth: boolean;
  firstArmorCardDoubled: boolean;

  // --- Health ---
  campfireHealBonus: number;
  healthThresholdBlock: { threshold: number; amount: number } | null;
  maxHealthPerCombat: number;
  startHealth: number;
  healMultiplier: number;
  healthThresholdArmor: { threshold: number; amount: number } | null;

  // --- Burn ---
  firstBurnCardDoubled: boolean;
  burnRemovesEnemyArmor: boolean;
  burnDoubleChance: number;
  receiveHalfBurnDamage: boolean;

  // --- Gold ---
  shopCardDiscount: number;
  shopFreeRefresh: boolean;
  startGold: number;
  goldPerCombat: number;
  potionDiscount: number;
  potionManaBonus: number;
  removeCardDiscount: number;
  enemyGoldDropBonus: number;
  eliteGoldDropBonus: number;
  goldOnWish: number;
  mixPotionDiscount: number;

  // --- Holy ---
  holyLifestealPercent: number;
  firstHolyCardFree: boolean;
  holyGoldPercent: number;
  holyBurnChance: number;
  receiveHalfHolyDamage: boolean;
  holyBlockPercent: number;
  holyWishChance: number;
  holyBlockPercentFromDamage: number;
  holyVsBurnMultiplier: number;

  // --- Wish ---
  goldOnWishAmount: number;
  wishUndiscoveredCards: boolean;
  healthOnWish: number;
  removeHarmfulStatusOnWish: boolean;
  wishExtraChoiceChance: number;
  wishDrawsCard: boolean;

  // --- Poison ---
  firstPoisonCardFree: boolean;
  poisonPhysicalBonus: number;
  poisonGainChance: number;
  receiveHalfPoisonDamage: boolean;
  goldOnFirstPoison: number;
  poisonHalvesHealing: boolean;

  companionDamage: number;
  companionGoldFindActive: boolean;

  // --- Freeze ---
  freezeThresholdReduction: number;
  freezeDoubleDamage: boolean;

  // --- Trap ---
  flatTrapDamage: number;

  // --- Bleed ---
  firstBleedCardFree: boolean;
  bleedPhysicalBonus: number;
  bleedLeechChance: number;
  bleedEnemyDamageReduction: number;
  bleedPhysicalTakenBonus: number;
  bleedExecuteThreshold: number;
  bleedDesperateMultiplier: number;
  bleedPoisonChance: number;
};

export const harmfulPlayerStatusIds: PlayerStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
