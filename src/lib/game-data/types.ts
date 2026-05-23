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

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "nature" | "trap";

export type PlayerStatusId = "block" | "armor" | "forge" | "haste" | "burn" | "poison" | "bleed" | "freeze" | "stun";

export type EnemyStatusId = "burn" | "poison" | "bleed" | "freeze" | "stun";

export type CompanionId = "wolf" | "lizard-scout" | "imp" | "frost-whelp" | "bear" | "panther" | "phoenix";

export type EnemyAttackEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean }
  | { kind: "player-status"; status: PlayerStatusId; amount: number };

export type EnemyTrait = {
  id: string;
  title: string;
  description: string;
};

export type BattleCardEffect =
  | {
      kind: "damage";
      damageType: DamageType;
      amount: number;
      lifesteal?: boolean;
      equalToBlock?: boolean;
      equalToArmor?: boolean;
    }
  | {
      kind: "player-status";
      status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste">;
      amount: number;
      perManaCrystal?: number;
    }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-harmful-status"; amount: number }
  | { kind: "remove-player-status"; status: EnemyStatusId }
  | { kind: "self-damage"; damageType: EnemyStatusId; amount: number }
  | { kind: "buff-companion"; amount: number }
  | { kind: "lose-health"; amount: number }
  | { kind: "draw-cards"; amount: number }
  | { kind: "remove-enemy-armor"; amount: number }
  | { kind: "multiply-enemy-status"; status: EnemyStatusId; factor: number };

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
  flatStunDamage: number;
  blockOnStun: number;
  forgeOnStun: number;
  stunStripArmor: boolean;
  manaOnStun: number;

  // --- Block ---
  startBlock: number;
  blockToPhysicalDamage: boolean;
  blockPreventsBleed: boolean;
  blockPreventsPoison: boolean;
  blockPreventsStun: boolean;
  blockAbsorbPhysicalBonus: number;
  blockReduceBurnDamage: number;
  blockDepletedHeal: number;
  blockToHolyDamage: boolean;
  blockToStunDamage: boolean;

  // --- Forge ---
  startForge: number;
  forgeToBurn: boolean;
  forgeToHoly: boolean;
  forgeToBlock: boolean;
  forgeToBleed: boolean;
  forgeBurnThreshold: number;
  forgeBurnDamage: number;
  forgeStripArmorThreshold: number;
  flatForgeGained: number;
  forgeDoubledBelowHalfHealth: boolean;
  forgeBlockThreshold: number;
  forgeBlockAmount: number;

  // --- Armor ---
  armorMitigatesBurn: boolean;
  armorBlockThreshold: number;
  armorBlockAmount: number;
  armorDoubledBelowHalfHealth: boolean;
  firstArmorCardDoubled: boolean;
  startArmor: number;
  armorMitigatesBleed: boolean;
  armorBreakBlock: number;
  armorMitigatesStun: boolean;
  armorCleanseThreshold: number;
  flatArmorAmount: number;

  // --- Health ---
  campfireHealBonus: number;
  healthThresholdBlock: { threshold: number; amount: number } | null;
  maxHealthPerCombat: number;
  startHealth: number;
  healMultiplier: number;
  healthThresholdArmor: { threshold: number; amount: number } | null;
  overhealToBlockRatio: number;
  healOnStatusCleanse: number;
  deathsDoorExtension: number;
  damageReduction: number;

  // --- Burn ---
  firstBurnCardDoubled: boolean;
  burnRemovesEnemyArmor: boolean;
  burnDoubleChance: number;
  receiveHalfBurnDamage: boolean;
  flatBurnDamage: number;
  forgeOnPlayerBurnDamage: number;
  burnReducesEnemyDamage: number;
  burnOnConsumeAmount: number;
  forgeOnBurnTickWithBlock: number;
  burnOnWish: number;

  // --- Gold ---
  shopCardDiscount: number;
  shopFreeRefresh: boolean;
  startGold: number;
  goldPerCombat: number;
  potionDiscount: number;
  potionPotency: number;
  removeCardDiscount: number;
  enemyGoldDropBonus: number;
  eliteGoldDropBonus: number;
  goldOnWish: number;
  mixPotionDiscount: number;

  // --- Companions ---
  companionBondLevels: Record<CompanionId, number>;

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
  blockOnFreeze: number;
  freezeStripArmor: boolean;
  startFreeze: number;
  companionVsFrozenBonus: number;
  freezePreventsPoisonDecay: boolean;
  freezeBlocksRegen: boolean;
  freezePreventsEnemyScaling: boolean;
  receiveHalfFreezeBuildUp: boolean;

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

/** UI chip order — keep aligned with PlayerStatusId union. */
export const PLAYER_STATUS_DISPLAY_ORDER: readonly PlayerStatusId[] = [
  "block",
  "armor",
  "forge",
  "haste",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
];

/** UI chip order — keep aligned with EnemyStatusId union. */
export const ENEMY_STATUS_DISPLAY_ORDER: readonly EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
