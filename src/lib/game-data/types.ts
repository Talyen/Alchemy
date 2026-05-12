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
  | "ailment"
  | "consume"
  | "poison"
  | "bleed"
  | "leech"
  | "freeze"
  | "mana"
  | "nature"
  | "companion"
  | "trap";

export type CardTemplate = "mechanical" | "nature" | "arcane" | "holy" | "alchemy";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze";

export type PlayerStatusId = "block" | "armor" | "forge" | "haste" | "burn" | "poison" | "bleed" | "freeze" | "stun";

export type EnemyStatusId = "burn" | "poison" | "bleed" | "freeze" | "stun";

export type CompanionId = "wolf" | "lizard-scout" | "imp";

export type EnemyAttackEffect =
  | { kind: "damage"; damageType: "physical"; amount: number; lifesteal?: boolean }
  | { kind: "player-status"; status: PlayerStatusId; amount: number };

export type EnemyTrait = {
  id: string;
  title: string;
  description: string;
};

export type BattleCardEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean; fromBlock?: boolean }
  | { kind: "player-status"; status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste">; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-ailment"; mode: "one" | "all" };

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
  template: CardTemplate;
  consume?: boolean;
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
  removeAilmentOnWish: boolean;
  wishExtraChoiceChance: number;
  wishDrawsCard: boolean;

  // --- Poison ---
  firstPoisonCardFree: boolean;
  poisonPhysicalBonus: number;
  poisonGainChance: number;
  receiveHalfPoisonDamage: boolean;
  goldOnFirstPoison: number;
  poisonHalvesHealing: boolean;

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

export const ailmentStatusIds: PlayerStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
