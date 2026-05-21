// Unlockable talent data and conversion into flat combat effect manifests.
// Depends on keyword IDs and battle talent effect shapes.
// Used by talent UI/state and battle setup to avoid scanning raw talent IDs during combat.
import type { KeywordId, TalentEffectManifest } from "./types";

// A talent definition — just an ID + description. Talent names were removed
// per player feedback; the description is self-explanatory. New talents can be
// added by simply appending to the talentPool array below.
export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  description: string;
  effects?: TalentEffectOperation[];
}

type NumericTalentEffectField = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];

type TalentEffectSetOperation = {
  [K in keyof TalentEffectManifest]: { kind: "set"; field: K; value: TalentEffectManifest[K] };
}[keyof TalentEffectManifest];

type TalentEffectAddOperation = { kind: "add"; field: NumericTalentEffectField; amount: number };

export type TalentEffectOperation = TalentEffectSetOperation | TalentEffectAddOperation;

function addEffect(field: NumericTalentEffectField, amount: number): TalentEffectAddOperation {
  // Additive rules let repeated talents stack without duplicating manifest reduction logic.
  return { kind: "add", field, amount };
}

function setEffect<K extends keyof TalentEffectManifest>(
  field: K,
  value: TalentEffectManifest[K],
): TalentEffectSetOperation {
  // Set rules encode one-off unlocks beside their talent text while preserving field types.
  return { kind: "set", field, value } as TalentEffectSetOperation;
}

function placeholderTalents(keywordId: KeywordId, idPrefix: string, start: number, end: number): TalentDefinition[] {
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    id: `${idPrefix}-${start + index}`,
    keywordId,
    description: "Placeholder talent (NYI)",
  }));
}

// The full pool of unlockable talents. Most keywords have 10 talents for a 2x5 or equivalent grid.
export const talentPool: TalentDefinition[] = [
  // --- Physical ---
  {
    id: "physical-dmg-1",
    keywordId: "physical",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-2",
    keywordId: "physical",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-3",
    keywordId: "physical",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-first-free",
    keywordId: "physical",
    description: "Your first Physical card each combat is free",
    effects: [setEffect("firstPhysicalCardFree", true)],
  },
  {
    id: "physical-vs-stunned",
    keywordId: "physical",
    description: "Enemies take 20% more Physical damage when Stunned",
    effects: [setEffect("physicalVsStunnedMultiplier", 20)],
  },
  {
    id: "physical-vs-frozen",
    keywordId: "physical",
    description: "Enemies take 40% more Physical damage when Frozen",
    effects: [setEffect("physicalVsFrozenMultiplier", 40)],
  },
  {
    id: "physical-armor",
    keywordId: "physical",
    description: "Physical Damage is increased by your Armor",
    effects: [setEffect("armorToPhysicalDamage", true)],
  },
  {
    id: "physical-crit",
    keywordId: "physical",
    description: "Physical Damage has +5% Critical Chance",
    effects: [setEffect("physicalCritChance", 5)],
  },
  {
    id: "physical-dmg-4",
    keywordId: "physical",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-5",
    keywordId: "physical",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },

  // --- Stun ---
  {
    id: "stun-threshold",
    keywordId: "stun",
    description: "Stun threshold reduced by 10%",
    effects: [setEffect("stunThresholdReduction", 0.1)],
  },
  {
    id: "stun-draw",
    keywordId: "stun",
    description: "When you Stun an enemy, draw a card",
    effects: [setEffect("drawOnStun", 1)],
  },
  {
    id: "stun-next-free",
    keywordId: "stun",
    description: "When you Stun an enemy, your next card is free",
    effects: [setEffect("nextCardFreeOnStun", true)],
  },
  {
    id: "stun-duration-1",
    keywordId: "stun",
    description: "Stun effects last 1 turn longer",
    effects: [setEffect("stunDurationExtension", 1)],
  },
  {
    id: "stun-double-damage",
    keywordId: "stun",
    description: "Stunned enemies take double damage",
    effects: [setEffect("stunDoubleDamage", true)],
  },
  {
    id: "stun-placeholder-2",
    keywordId: "stun",
    description: "Stun damage +1",
    effects: [addEffect("flatStunDamage", 1)],
  },
  {
    id: "stun-placeholder-3",
    keywordId: "stun",
    description: "When you Stun an enemy, gain 3 Block",
    effects: [setEffect("blockOnStun", 3)],
  },
  {
    id: "stun-placeholder-4",
    keywordId: "stun",
    description: "When you Stun an enemy, gain 2 Forge",
    effects: [setEffect("forgeOnStun", 2)],
  },
  {
    id: "stun-placeholder-5",
    keywordId: "stun",
    description: "Stunned enemies lose all Armor",
    effects: [setEffect("stunStripArmor", true)],
  },
  {
    id: "stun-placeholder-6",
    keywordId: "stun",
    description: "When you Stun an enemy, gain 1 Mana",
    effects: [setEffect("manaOnStun", 1)],
  },

  // --- Block ---
  {
    id: "block-start",
    keywordId: "block",
    description: "Start combat with 10 Block",
    effects: [setEffect("startBlock", 10)],
  },
  {
    id: "block-to-physical",
    keywordId: "block",
    description: "Increase Physical damage by half your Block",
    effects: [setEffect("blockToPhysicalDamage", true)],
  },
  {
    id: "block-prevent-bleed",
    keywordId: "block",
    description: "Block prevents receiving Bleed status effects",
    effects: [setEffect("blockPreventsBleed", true)],
  },
  {
    id: "block-prevent-poison",
    keywordId: "block",
    description: "Block prevents receiving Poison status effects",
    effects: [setEffect("blockPreventsPoison", true)],
  },
  {
    id: "block-prevent-stun",
    keywordId: "block",
    description: "Block prevents receiving Stun buildup",
    effects: [setEffect("blockPreventsStun", true)],
  },
  {
    id: "block-absorb-physical",
    keywordId: "block",
    description: "Block absorbs 20% more Physical damage",
    effects: [setEffect("blockAbsorbPhysicalBonus", 20)],
  },
  ...placeholderTalents("block", "block-amount", 1, 4),

  // --- Forge ---
  {
    id: "forge-to-burn",
    keywordId: "forge",
    description: "Forge also increases Burn damage",
    effects: [setEffect("forgeToBurn", true)],
  },
  {
    id: "forge-to-holy",
    keywordId: "forge",
    description: "Forge also increases Holy damage",
    effects: [setEffect("forgeToHoly", true)],
  },
  {
    id: "forge-to-block",
    keywordId: "forge",
    description: "Forge also increases Block amount",
    effects: [setEffect("forgeToBlock", true)],
  },
  {
    id: "forge-burn-burst",
    keywordId: "forge",
    description: "Upon reaching 4 Forge, deal 8 Burn",
    effects: [setEffect("forgeBurnThreshold", 4), setEffect("forgeBurnDamage", 8)],
  },
  ...placeholderTalents("forge", "forge-strength", 1, 6),

  // --- Armor ---
  {
    id: "armor-burn-mitigate",
    keywordId: "armor",
    description: "Armor now mitigates Burn damage taken",
    effects: [setEffect("armorMitigatesBurn", true)],
  },
  {
    id: "armor-block-burst",
    keywordId: "armor",
    description: "Upon reaching 4 Armor, gain 8 Block",
    effects: [setEffect("armorBlockThreshold", 4), setEffect("armorBlockAmount", 8)],
  },
  {
    id: "armor-desperate-double",
    keywordId: "armor",
    description: "Armor gained is doubled when Health is below 50%",
    effects: [setEffect("armorDoubledBelowHalfHealth", true)],
  },
  {
    id: "armor-first-double",
    keywordId: "armor",
    description: "Your first Armor card each combat is doubled",
    effects: [setEffect("firstArmorCardDoubled", true)],
  },
  ...placeholderTalents("armor", "armor-amount", 1, 6),

  // --- Health ---
  {
    id: "health-campfire",
    keywordId: "health",
    description: "Campfire heals 10% more Health",
    effects: [setEffect("campfireHealBonus", 0.1)],
  },
  {
    id: "health-threshold-block",
    keywordId: "health",
    description: "When Health drops below 50%, gain 6 Block",
    effects: [setEffect("healthThresholdBlock", { threshold: 50, amount: 6 })],
  },
  {
    id: "health-max-per-combat",
    keywordId: "health",
    description: "Gain 1 Max Health after every combat",
    effects: [setEffect("maxHealthPerCombat", 1)],
  },
  {
    id: "health-start",
    keywordId: "health",
    description: "Gain 4 Health at the start of combat",
    effects: [setEffect("startHealth", 4)],
  },
  {
    id: "health-heal-boost",
    keywordId: "health",
    description: "Healing effects are 10% stronger",
    effects: [setEffect("healMultiplier", 1.1)],
  },
  {
    id: "health-threshold-armor",
    keywordId: "health",
    description: "When Health drops below 25%, gain 3 Armor",
    effects: [setEffect("healthThresholdArmor", { threshold: 25, amount: 3 })],
  },
  ...placeholderTalents("health", "health-max", 1, 4),

  // --- Burn ---
  {
    id: "burn-first-double",
    keywordId: "burn",
    description: "Your first Burn card each combat is doubled",
    effects: [setEffect("firstBurnCardDoubled", true)],
  },
  {
    id: "burn-remove-armor",
    keywordId: "burn",
    description: "Burn damage removes that amount of enemy Armor",
    effects: [setEffect("burnRemovesEnemyArmor", true)],
  },
  {
    id: "burn-double-chance",
    keywordId: "burn",
    description: "Burn stacks have a 5% chance to double instead of halve",
    effects: [setEffect("burnDoubleChance", 5)],
  },
  {
    id: "burn-half-damage",
    keywordId: "burn",
    description: "Receive half Burn damage",
    effects: [setEffect("receiveHalfBurnDamage", true)],
  },
  ...placeholderTalents("burn", "burn-dmg", 1, 6),

  // --- Gold ---
  {
    id: "gold-shop-discount",
    keywordId: "gold",
    description: "Shop cards cost 5 less Gold",
    effects: [setEffect("shopCardDiscount", 5)],
  },
  {
    id: "gold-shop-refresh",
    keywordId: "gold",
    description: "Shop refresh is free once per visit",
    effects: [setEffect("shopFreeRefresh", true)],
  },
  {
    id: "gold-start",
    keywordId: "gold",
    description: "Start each run with 20 Gold",
    effects: [setEffect("startGold", 20)],
  },
  {
    id: "gold-per-combat",
    keywordId: "gold",
    description: "Gain +5 Gold after each combat",
    effects: [setEffect("goldPerCombat", 5)],
  },
  {
    id: "gold-potion-discount",
    keywordId: "gold",
    description: "Potions cost 5 less Gold",
    effects: [setEffect("potionDiscount", 5)],
  },
  {
    id: "gold-remove-discount",
    keywordId: "gold",
    description: "Card removal costs 10 less Gold",
    effects: [setEffect("removeCardDiscount", 10)],
  },
  {
    id: "gold-enemy-drop",
    keywordId: "gold",
    description: "Enemies drop 10% more Gold",
    effects: [setEffect("enemyGoldDropBonus", 0.1)],
  },
  {
    id: "gold-on-wish",
    keywordId: "gold",
    description: "Gain 3 Gold when you Wish",
    effects: [setEffect("goldOnWish", 3)],
  },
  {
    id: "gold-mix-discount",
    keywordId: "gold",
    description: "Mix Potions costs 10 less Gold",
    effects: [setEffect("mixPotionDiscount", 10)],
  },
  {
    id: "gold-elite-drop",
    keywordId: "gold",
    description: "Elites drop 10% more Gold",
    effects: [setEffect("eliteGoldDropBonus", 0.1)],
  },

  // --- Holy ---
  {
    id: "holy-lifesteal",
    keywordId: "holy",
    description: "Holy damage heals you for 10% of the amount dealt",
    effects: [setEffect("holyLifestealPercent", 10)],
  },
  {
    id: "holy-first-free",
    keywordId: "holy",
    description: "Your first Holy card each combat is free",
    effects: [setEffect("firstHolyCardFree", true)],
  },
  {
    id: "holy-gold-scaling",
    keywordId: "holy",
    description: "Holy damage is increased by 3% of your Gold",
    effects: [setEffect("holyGoldPercent", 3)],
  },
  {
    id: "holy-burn-chance",
    keywordId: "holy",
    description: "Holy damage has a 10% chance to Burn",
    effects: [setEffect("holyBurnChance", 10)],
  },
  {
    id: "holy-half-damage",
    keywordId: "holy",
    description: "Receive half Holy damage",
    effects: [setEffect("receiveHalfHolyDamage", true)],
  },
  {
    id: "holy-block-scaling",
    keywordId: "holy",
    description: "Holy damage is increased by 10% of your Block",
    effects: [setEffect("holyBlockPercent", 10)],
  },
  {
    id: "holy-wish-chance",
    keywordId: "holy",
    description: "Holy damage has a 5% chance to Wish",
    effects: [setEffect("holyWishChance", 5)],
  },
  {
    id: "holy-block-grant",
    keywordId: "holy",
    description: "Holy damage grants Block for 15% of the amount dealt",
    effects: [setEffect("holyBlockPercentFromDamage", 15)],
  },
  {
    id: "holy-vs-burn",
    keywordId: "holy",
    description: "Holy damage is increased by 20% against enemies with Burn",
    effects: [setEffect("holyVsBurnMultiplier", 20)],
  },
  { id: "holy-dmg-1", keywordId: "holy", description: "Placeholder talent (NYI)" },

  // --- Wish ---
  {
    id: "wish-gold",
    keywordId: "wish",
    description: "Gain 2 Gold when you Wish",
    effects: [setEffect("goldOnWishAmount", 2)],
  },
  {
    id: "wish-undiscovered",
    keywordId: "wish",
    description: "Wish can offer cards not yet in your collection",
    effects: [setEffect("wishUndiscoveredCards", true)],
  },
  {
    id: "wish-health",
    keywordId: "wish",
    description: "Gain 2 Health when you Wish",
    effects: [setEffect("healthOnWish", 2)],
  },
  {
    id: "wish-cleanse",
    keywordId: "wish",
    description: "Remove a harmful status effect when you Wish",
    effects: [setEffect("removeHarmfulStatusOnWish", true)],
  },
  {
    id: "wish-extra-choice",
    keywordId: "wish",
    description: "Wish has a 20% chance to offer an extra card choice",
    effects: [setEffect("wishExtraChoiceChance", 20)],
  },
  {
    id: "wish-draw",
    keywordId: "wish",
    description: "Wish also draws a card",
    effects: [setEffect("wishDrawsCard", true)],
  },
  ...placeholderTalents("wish", "wish-choice", 1, 4),

  // --- Poison ---
  {
    id: "poison-first-free",
    keywordId: "poison",
    description: "Your first Poison card each combat is free",
    effects: [setEffect("firstPoisonCardFree", true)],
  },
  {
    id: "poison-physical-bonus",
    keywordId: "poison",
    description: "Enemies with Poison take +1 Physical damage",
    effects: [setEffect("poisonPhysicalBonus", 1)],
  },
  {
    id: "poison-gain-chance",
    keywordId: "poison",
    description: "Poison has a 10% chance to gain instead of lose a stack",
    effects: [setEffect("poisonGainChance", 10)],
  },
  {
    id: "poison-half-damage",
    keywordId: "poison",
    description: "Receive half Poison damage",
    effects: [setEffect("receiveHalfPoisonDamage", true)],
  },
  {
    id: "poison-gold-first",
    keywordId: "poison",
    description: "The first time you Poison each combat, gain 4 Gold",
    effects: [setEffect("goldOnFirstPoison", 4)],
  },
  {
    id: "poison-heal-reduce",
    keywordId: "poison",
    description: "Poison reduces enemy healing by half",
    effects: [setEffect("poisonHalvesHealing", true)],
  },
  ...placeholderTalents("poison", "poison-dmg", 1, 4),

  // --- Bleed ---
  {
    id: "bleed-first-free",
    keywordId: "bleed",
    description: "Your first Bleed card each combat is free",
    effects: [setEffect("firstBleedCardFree", true)],
  },
  {
    id: "bleed-physical-bonus",
    keywordId: "bleed",
    description: "Bleed increases Physical damage taken by 1",
    effects: [setEffect("bleedPhysicalBonus", 1)],
  },
  {
    id: "bleed-leech-chance",
    keywordId: "bleed",
    description: "Bleed has a 15% chance to Leech",
    effects: [setEffect("bleedLeechChance", 15)],
  },
  {
    id: "bleed-enemy-weak",
    keywordId: "bleed",
    description: "Enemies with Bleed deal 1 less damage",
    effects: [setEffect("bleedEnemyDamageReduction", 1)],
  },
  {
    id: "bleed-physical-taken",
    keywordId: "bleed",
    description: "Enemies with Bleed take +1 Physical damage",
    effects: [setEffect("bleedPhysicalTakenBonus", 1)],
  },
  {
    id: "bleed-execute",
    keywordId: "bleed",
    description: "Bleed deals double damage against enemies below 30% Health",
    effects: [setEffect("bleedExecuteThreshold", 30)],
  },
  {
    id: "bleed-desperate",
    keywordId: "bleed",
    description: "You deal double Bleed damage if you are below 50% Health",
    effects: [setEffect("bleedDesperateMultiplier", 2)],
  },
  {
    id: "bleed-poison-chance",
    keywordId: "bleed",
    description: "Bleed has a 10% chance to Poison",
    effects: [setEffect("bleedPoisonChance", 10)],
  },
  ...placeholderTalents("bleed", "bleed-dmg", 1, 2),

  // --- Other keywords (placeholders retained for grid completeness) ---
  ...placeholderTalents("leech", "leech-heal", 1, 10),

  {
    id: "freeze-threshold",
    keywordId: "freeze",
    description: "Freeze threshold reduced by 10%",
    effects: [setEffect("freezeThresholdReduction", 0.1)],
  },
  {
    id: "freeze-double-damage",
    keywordId: "freeze",
    description: "Frozen enemies take double damage",
    effects: [setEffect("freezeDoubleDamage", true)],
  },
  ...placeholderTalents("freeze", "freeze-placeholder", 3, 10),

  ...placeholderTalents("mana", "mana-max", 1, 10),

  ...placeholderTalents("nature", "nature-placeholder", 1, 10),

  {
    id: "companion-damage",
    keywordId: "companion",
    description: "Increase Companion damage by 1",
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-gold-find",
    keywordId: "companion",
    description: "Companions sometimes find Gold after combat",
    effects: [setEffect("companionGoldFindActive", true)],
  },
  ...placeholderTalents("companion", "companion-placeholder", 3, 10),

  {
    id: "trap-damage",
    keywordId: "trap",
    description: "Increase Trap damage by 1",
    effects: [addEffect("flatTrapDamage", 1)],
  },
  ...placeholderTalents("trap", "trap-placeholder", 2, 10),
];

// Filter helpers for the talent selection UI.
export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

function getAvailableTalents(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((t) => !unlockedIds.includes(t.id));
}

// Returns the next N unlockable talents in pool order (top-to-bottom, left-to-right).
export function sampleTalentChoices(
  keywordId: KeywordId,
  unlockedIds: string[],
  count: number = 1,
): TalentDefinition[] {
  const available = getAvailableTalents(keywordId, unlockedIds);
  return available.slice(0, count);
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;

// Returns a manifest with all zero/false/null values — the safe default when no talents are
// unlocked. New TalentEffectManifest fields must be added here AND in computeTalentEffects.
export function createEmptyTalentManifest(): TalentEffectManifest {
  return {
    flatPhysicalDamage: 0,
    armorToPhysicalDamage: false,
    physicalCritChance: 0,
    firstPhysicalCardFree: false,
    physicalVsStunnedMultiplier: 0,
    physicalVsFrozenMultiplier: 0,

    stunThresholdReduction: 0,
    drawOnStun: 0,
    nextCardFreeOnStun: false,
    stunDurationExtension: 0,
    stunDoubleDamage: false,
    flatStunDamage: 0,
    blockOnStun: 0,
    forgeOnStun: 0,
    stunStripArmor: false,
    manaOnStun: 0,

    startBlock: 0,
    blockToPhysicalDamage: false,
    blockPreventsBleed: false,
    blockPreventsPoison: false,
    blockPreventsStun: false,
    blockAbsorbPhysicalBonus: 0,

    forgeToBurn: false,
    forgeToHoly: false,
    forgeToBlock: false,
    forgeBurnThreshold: 0,
    forgeBurnDamage: 0,

    armorMitigatesBurn: false,
    armorBlockThreshold: 0,
    armorBlockAmount: 0,
    armorDoubledBelowHalfHealth: false,
    firstArmorCardDoubled: false,

    campfireHealBonus: 0,
    healthThresholdBlock: null,
    maxHealthPerCombat: 0,
    startHealth: 0,
    healMultiplier: 1,
    healthThresholdArmor: null,

    firstBurnCardDoubled: false,
    burnRemovesEnemyArmor: false,
    burnDoubleChance: 0,
    receiveHalfBurnDamage: false,

    shopCardDiscount: 0,
    shopFreeRefresh: false,
    startGold: 0,
    goldPerCombat: 0,
    potionDiscount: 0,
    potionManaBonus: 0,
    potionPotency: 1,
    removeCardDiscount: 0,
    enemyGoldDropBonus: 0,
    eliteGoldDropBonus: 0,
    goldOnWish: 0,
    mixPotionDiscount: 0,
    companionBondLevels: { wolf: 0, "lizard-scout": 0, imp: 0, "frost-whelp": 0, bear: 0, panther: 0, phoenix: 0 },

    holyLifestealPercent: 0,
    firstHolyCardFree: false,
    holyGoldPercent: 0,
    holyBurnChance: 0,
    receiveHalfHolyDamage: false,
    holyBlockPercent: 0,
    holyWishChance: 0,
    holyBlockPercentFromDamage: 0,
    holyVsBurnMultiplier: 0,

    goldOnWishAmount: 0,
    wishUndiscoveredCards: false,
    healthOnWish: 0,
    removeHarmfulStatusOnWish: false,
    wishExtraChoiceChance: 0,
    wishDrawsCard: false,

    firstPoisonCardFree: false,
    poisonPhysicalBonus: 0,
    poisonGainChance: 0,
    receiveHalfPoisonDamage: false,
    goldOnFirstPoison: 0,
    poisonHalvesHealing: false,

    companionDamage: 0,
    companionGoldFindActive: false,

    freezeThresholdReduction: 0,
    freezeDoubleDamage: false,

    flatTrapDamage: 0,

    firstBleedCardFree: false,
    bleedPhysicalBonus: 0,
    bleedLeechChance: 0,
    bleedEnemyDamageReduction: 0,
    bleedPhysicalTakenBonus: 0,
    bleedExecuteThreshold: 0,
    bleedDesperateMultiplier: 1,
    bleedPoisonChance: 0,
  };
}

// Collapse unlocked IDs into a flat manifest once per change/battle. Combat code reads
// numbers/booleans directly, which keeps turn resolution decoupled from talent grid data.
export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentManifest();
  const unlockedIds = new Set(Object.values(unlockedTalents).flat());

  for (const talent of talentPool) {
    if (!unlockedIds.has(talent.id)) continue;
    for (const effect of talent.effects ?? []) {
      applyTalentEffect(manifest, effect);
    }
  }

  return manifest;
}

function applyTalentEffect(manifest: TalentEffectManifest, effect: TalentEffectOperation) {
  // Data-driven talent effects keep descriptions and mechanics adjacent in talentPool.
  if (effect.kind === "add") {
    manifest[effect.field] += effect.amount;
    return;
  }

  setTalentEffect(manifest, effect.field, effect.value);
}

function setTalentEffect<K extends keyof TalentEffectManifest>(
  manifest: TalentEffectManifest,
  field: K,
  value: TalentEffectManifest[K],
) {
  // Centralized assignment keeps the generic reducer type-safe for all manifest field shapes.
  manifest[field] = value;
}
