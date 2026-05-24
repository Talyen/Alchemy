/**
 * Talent definitions, pools, UI filter/sampling helpers, and default manifests.
 * Depends on: src/lib/game-data/types.ts
 * Depended on by: src/lib/talents.ts, homestead, and the battle state machine
 */
import type { KeywordId, TalentEffectManifest } from "./types";

export const TALENTS_CONFIG = {
  PLACEHOLDER_DESCRIPTION: "Placeholder talent (NYI)",
} as const;

// A talent definition — ID, keyword, optional short name for UI tooltips, and
// description (rules text). New talents can be added by simply appending to
// the talentPool array below.
export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  name?: string;
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
  return Array.from({ length: end - start + 1 }, (_, index) => {
    return {
      id: `${idPrefix}-${start + index}`,
      keywordId,
      name: `Placeholder ${index + 1}`,
      description: TALENTS_CONFIG.PLACEHOLDER_DESCRIPTION,
    };
  });
}

// The full pool of unlockable talents. Most keywords have 10 talents for a 2x5 or equivalent grid.
export const talentPool: TalentDefinition[] = [
  // --- Physical ---
  {
    id: "physical-dmg-1",
    keywordId: "physical",
    name: "Heavy Blows",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-2",
    keywordId: "physical",
    name: "Brute Force",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-3",
    keywordId: "physical",
    name: "Crushing Strikes",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-first-free",
    keywordId: "physical",
    name: "Free Swing",
    description: "Your first Physical card each combat is free",
    effects: [setEffect("firstPhysicalCardFree", true)],
  },
  {
    id: "physical-vs-stunned",
    keywordId: "physical",
    name: "Punish the Stunned",
    description: "Enemies take 20% more Physical damage when Stunned",
    effects: [setEffect("physicalVsStunnedMultiplier", 20)],
  },
  {
    id: "physical-vs-frozen",
    keywordId: "physical",
    name: "Shatter Strike",
    description: "Enemies take 40% more Physical damage when Frozen",
    effects: [setEffect("physicalVsFrozenMultiplier", 40)],
  },
  {
    id: "physical-armor",
    keywordId: "physical",
    name: "Armored Fists",
    description: "Physical Damage is increased by your Armor",
    effects: [setEffect("armorToPhysicalDamage", true)],
  },
  {
    id: "physical-crit",
    keywordId: "physical",
    name: "Keen Edge",
    description: "Physical Damage has +5% Critical Chance",
    effects: [setEffect("physicalCritChance", 5)],
  },
  {
    id: "physical-dmg-4",
    keywordId: "physical",
    name: "Raw Power",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-dmg-5",
    keywordId: "physical",
    name: "Unrelenting",
    description: "Increase Physical Damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },

  // --- Stun ---
  {
    id: "stun-threshold",
    keywordId: "stun",
    name: "Concussive Force",
    description: "Stun threshold reduced by 10%",
    effects: [setEffect("stunThresholdReduction", 0.1)],
  },
  {
    id: "stun-draw",
    keywordId: "stun",
    name: "Stun Insight",
    description: "When you Stun an enemy, draw a card",
    effects: [setEffect("drawOnStun", 1)],
  },
  {
    id: "stun-next-free",
    keywordId: "stun",
    name: "Free Follow-up",
    description: "When you Stun an enemy, your next card is free",
    effects: [setEffect("nextCardFreeOnStun", true)],
  },
  {
    id: "stun-duration-1",
    keywordId: "stun",
    name: "Extended Stun",
    description: "Stun effects last 1 turn longer",
    effects: [setEffect("stunDurationExtension", 1)],
  },
  {
    id: "stun-double-damage",
    keywordId: "stun",
    name: "Exploit Weakness",
    description: "Stunned enemies take double damage",
    effects: [setEffect("stunDoubleDamage", true)],
  },
  {
    id: "stun-damage-1",
    keywordId: "stun",
    name: "Jarring Blow",
    description: "Stun damage +1",
    effects: [addEffect("flatStunDamage", 1)],
  },
  {
    id: "stun-block-grant",
    keywordId: "stun",
    name: "Guarded Counter",
    description: "When you Stun an enemy, gain 3 Block",
    effects: [setEffect("blockOnStun", 3)],
  },
  {
    id: "stun-forge-grant",
    keywordId: "stun",
    name: "Riled Up",
    description: "When you Stun an enemy, gain 2 Forge",
    effects: [setEffect("forgeOnStun", 2)],
  },
  {
    id: "stun-strip-armor",
    keywordId: "stun",
    name: "Shatter Guard",
    description: "Stunned enemies lose all Armor",
    effects: [setEffect("stunStripArmor", true)],
  },
  {
    id: "stun-mana-grant",
    keywordId: "stun",
    name: "Stun Surge",
    description: "When you Stun an enemy, gain 1 Mana",
    effects: [setEffect("manaOnStun", 1)],
  },

  // --- Block ---
  {
    id: "block-start",
    keywordId: "block",
    name: "Fortify",
    description: "Start combat with 10 Block",
    effects: [setEffect("startBlock", 10)],
  },
  {
    id: "block-to-physical",
    keywordId: "block",
    name: "Weighted Guard",
    description: "Increase Physical damage by half your Block",
    effects: [setEffect("blockToPhysicalDamage", true)],
  },
  {
    id: "block-prevent-bleed",
    keywordId: "block",
    name: "Coagulate",
    description: "Block prevents receiving Bleed status effects",
    effects: [setEffect("blockPreventsBleed", true)],
  },
  {
    id: "block-prevent-poison",
    keywordId: "block",
    name: "Detoxify",
    description: "Block prevents receiving Poison status effects",
    effects: [setEffect("blockPreventsPoison", true)],
  },
  {
    id: "block-prevent-stun",
    keywordId: "block",
    name: "Grounding",
    description: "Block prevents receiving Stun buildup",
    effects: [setEffect("blockPreventsStun", true)],
  },
  {
    id: "block-absorb-physical",
    keywordId: "block",
    name: "Reinforce",
    description: "Block absorbs 20% more Physical damage",
    effects: [setEffect("blockAbsorbPhysicalBonus", 20)],
  },
  {
    id: "block-reduce-burn",
    keywordId: "block",
    name: "Fireproof",
    description: "Block reduces Burn damage by 1",
    effects: [setEffect("blockReduceBurnDamage", 1)],
  },
  {
    id: "block-depleted-heal",
    keywordId: "block",
    name: "Second Wind",
    description: "When Block is depleted, Restore 2 Health",
    effects: [setEffect("blockDepletedHeal", 2)],
  },
  {
    id: "block-to-holy",
    keywordId: "block",
    name: "Sacred Shield",
    description: "Increase Holy damage by half your Block",
    effects: [setEffect("blockToHolyDamage", true)],
  },
  {
    id: "block-to-stun",
    keywordId: "block",
    name: "Impact Guard",
    description: "Increase Stun damage by half your Block",
    effects: [setEffect("blockToStunDamage", true)],
  },

  // --- Forge ---
  {
    id: "forge-to-burn",
    keywordId: "forge",
    name: "Ignite",
    description: "Forge also increases Burn damage",
    effects: [setEffect("forgeToBurn", true)],
  },
  {
    id: "forge-to-holy",
    keywordId: "forge",
    name: "Sanctify",
    description: "Forge also increases Holy damage",
    effects: [setEffect("forgeToHoly", true)],
  },
  {
    id: "forge-to-block",
    keywordId: "forge",
    name: "Tempered Guard",
    description: "Forge also increases Block amount",
    effects: [setEffect("forgeToBlock", true)],
  },
  {
    id: "forge-burn-burst",
    keywordId: "forge",
    name: "Overheat",
    description: "Upon reaching 4 Forge, deal 8 Burn",
    effects: [setEffect("forgeBurnThreshold", 4), setEffect("forgeBurnDamage", 8)],
  },
  {
    id: "forge-strength-1",
    keywordId: "forge",
    name: "Forge Mastery",
    description: "Start combat with 2 Forge",
    effects: [setEffect("startForge", 2)],
  },
  {
    id: "forge-strength-2",
    keywordId: "forge",
    name: "Rust",
    description: "Forge also increases Bleed damage",
    effects: [setEffect("forgeToBleed", true)],
  },
  {
    id: "forge-strength-3",
    keywordId: "forge",
    name: "Sunder",
    description: "When you reach 6 Forge, remove all enemy Armor",
    effects: [setEffect("forgeStripArmorThreshold", 6)],
  },
  {
    id: "forge-strength-4",
    keywordId: "forge",
    name: "Intensify",
    description: "Increase Forge gained by 1",
    effects: [addEffect("flatForgeGained", 1)],
  },
  {
    id: "forge-strength-5",
    keywordId: "forge",
    name: "Desperate Forge",
    description: "Forge gained is doubled when Health is below 50%",
    effects: [setEffect("forgeDoubledBelowHalfHealth", true)],
  },
  {
    id: "forge-strength-6",
    keywordId: "forge",
    name: "Forged Bulwark",
    description: "Upon reaching 6 Forge, gain 10 Block",
    effects: [setEffect("forgeBlockThreshold", 6), setEffect("forgeBlockAmount", 10)],
  },

  // --- Armor ---
  {
    id: "armor-burn-mitigate",
    keywordId: "armor",
    name: "Fireward",
    description: "Armor now mitigates Burn damage taken",
    effects: [setEffect("armorMitigatesBurn", true)],
  },
  {
    id: "armor-block-burst",
    keywordId: "armor",
    name: "Armored Surge",
    description: "Upon reaching 4 Armor, gain 8 Block",
    effects: [setEffect("armorBlockThreshold", 4), setEffect("armorBlockAmount", 8)],
  },
  {
    id: "armor-desperate-double",
    keywordId: "armor",
    name: "Last Stand",
    description: "Armor gained is doubled when Health is below 50%",
    effects: [setEffect("armorDoubledBelowHalfHealth", true)],
  },
  {
    id: "armor-first-double",
    keywordId: "armor",
    name: "Iron Guard",
    description: "Your first Armor card each combat is doubled",
    effects: [setEffect("firstArmorCardDoubled", true)],
  },
  {
    id: "armor-start-combat",
    keywordId: "armor",
    name: "Bulwark",
    description: "Start each combat with 2 Armor",
    effects: [setEffect("startArmor", 2)],
  },
  {
    id: "armor-mitigate-bleed",
    keywordId: "armor",
    name: "Thick Hide",
    description: "Armor now mitigates Bleed damage taken",
    effects: [setEffect("armorMitigatesBleed", true)],
  },
  {
    id: "armor-break-block",
    keywordId: "armor",
    name: "Reactive Guard",
    description: "When your Armor breaks, gain 5 Block",
    effects: [setEffect("armorBreakBlock", 5)],
  },
  {
    id: "armor-mitigate-stun",
    keywordId: "armor",
    name: "Steadfast",
    description: "Armor now reduces Stun buildup",
    effects: [setEffect("armorMitigatesStun", true)],
  },
  {
    id: "armor-cleanse-threshold",
    keywordId: "armor",
    name: "Purification",
    description: "Upon reaching 6 Armor, cleanse all harmful status effects",
    effects: [setEffect("armorCleanseThreshold", 6)],
  },
  {
    id: "armor-flat-bonus",
    keywordId: "armor",
    name: "Reinforced",
    description: "Increase Armor gained by 1",
    effects: [addEffect("flatArmorAmount", 1)],
  },

  // --- Health ---
  {
    id: "health-campfire",
    keywordId: "health",
    name: "Warm Rest",
    description: "Campfire heals 10% more Health",
    effects: [setEffect("campfireHealBonus", 0.1)],
  },
  {
    id: "health-threshold-block",
    keywordId: "health",
    name: "Desperate Guard",
    description: "When Health drops below 50%, gain 6 Block",
    effects: [setEffect("healthThresholdBlock", { threshold: 50, amount: 6 })],
  },
  {
    id: "health-max-per-combat",
    keywordId: "health",
    name: "Vitality",
    description: "Gain 1 Max Health after every combat",
    effects: [setEffect("maxHealthPerCombat", 1)],
  },
  {
    id: "health-start",
    keywordId: "health",
    name: "Combat Surge",
    description: "Gain 4 Health at the start of combat",
    effects: [setEffect("startHealth", 4)],
  },
  {
    id: "health-heal-boost",
    keywordId: "health",
    name: "Mending",
    description: "Healing effects are 10% stronger",
    effects: [setEffect("healMultiplier", 1.1)],
  },
  {
    id: "health-threshold-armor",
    keywordId: "health",
    name: "Last Resort",
    description: "When Health drops below 25%, gain 3 Armor",
    effects: [setEffect("healthThresholdArmor", { threshold: 25, amount: 3 })],
  },
  {
    id: "health-max-1",
    keywordId: "health",
    name: "Overflow",
    description: "When you overheal, gain 50% of the excess as Block",
    effects: [setEffect("overhealToBlockRatio", 0.5)],
  },
  {
    id: "health-max-2",
    keywordId: "health",
    name: "Cleansing Status",
    description: "Cleansing a status restores 6 Health",
    effects: [setEffect("healOnStatusCleanse", 6)],
  },
  {
    id: "health-max-3",
    keywordId: "health",
    name: "Thick Skin",
    description: "Reduce all damage taken by 1",
    effects: [setEffect("damageReduction", 1)],
  },
  {
    id: "health-max-4",
    keywordId: "health",
    name: "Will to Live",
    description: "Death's Door lasts 1 turn longer",
    effects: [setEffect("deathsDoorExtension", 1)],
  },

  // --- Burn ---
  {
    id: "burn-first-double",
    keywordId: "burn",
    name: "Wildfire",
    description: "Your first Burn card each combat is doubled",
    effects: [setEffect("firstBurnCardDoubled", true)],
  },
  {
    id: "burn-remove-armor",
    keywordId: "burn",
    name: "Melting Point",
    description: "Burn damage removes that amount of enemy Armor",
    effects: [setEffect("burnRemovesEnemyArmor", true)],
  },
  {
    id: "burn-double-chance",
    keywordId: "burn",
    name: "Smoldering",
    description: "Burn stacks have a 5% chance to double instead of halve",
    effects: [setEffect("burnDoubleChance", 5)],
  },
  {
    id: "burn-half-damage",
    keywordId: "burn",
    name: "Fire Resistance",
    description: "Receive half Burn damage",
    effects: [setEffect("receiveHalfBurnDamage", true)],
  },
  {
    id: "burn-dmg-1",
    keywordId: "burn",
    name: "Flashpoint",
    description: "Burn damage +1",
    effects: [addEffect("flatBurnDamage", 1)],
  },
  {
    id: "burn-dmg-2",
    keywordId: "burn",
    name: "Thermal Vent",
    description: "When you take Burn damage, gain 1 Forge",
    effects: [addEffect("forgeOnPlayerBurnDamage", 1)],
  },
  {
    id: "burn-dmg-3",
    keywordId: "burn",
    name: "Heat Exhaustion",
    description: "Enemies with Burn deal 1 less damage",
    effects: [addEffect("burnReducesEnemyDamage", 1)],
  },
  {
    id: "burn-dmg-4",
    keywordId: "burn",
    name: "Combustible",
    description: "When you play a card with Consume, deal 2 Burn damage to the enemy",
    effects: [setEffect("burnOnConsumeAmount", 2)],
  },
  {
    id: "burn-dmg-5",
    keywordId: "burn",
    name: "Flaming Shield",
    description: "When Block prevents Burn damage, gain 1 Forge",
    effects: [addEffect("forgeOnBurnTickWithBlock", 1)],
  },
  {
    id: "burn-dmg-6",
    keywordId: "burn",
    name: "Burning Wish",
    description: "When you play a Wish, deal 2 Burn damage to the enemy",
    effects: [setEffect("burnOnWish", 2)],
  },

  // --- Gold ---
  {
    id: "gold-shop-discount",
    keywordId: "gold",
    name: "Haggle",
    description: "Shop cards cost 5 less Gold",
    effects: [setEffect("shopCardDiscount", 5)],
  },
  {
    id: "gold-shop-refresh",
    keywordId: "gold",
    name: "Restock",
    description: "Shop refresh is free once per visit",
    effects: [setEffect("shopFreeRefresh", true)],
  },
  {
    id: "gold-start",
    keywordId: "gold",
    name: "Seed Money",
    description: "Start each run with 20 Gold",
    effects: [setEffect("startGold", 20)],
  },
  {
    id: "gold-per-combat",
    keywordId: "gold",
    name: "Bounty",
    description: "Gain +5 Gold after each combat",
    effects: [setEffect("goldPerCombat", 5)],
  },
  {
    id: "gold-potion-discount",
    keywordId: "gold",
    name: "Apothecary Bargain",
    description: "Potions cost 5 less Gold",
    effects: [setEffect("potionDiscount", 5)],
  },
  {
    id: "gold-remove-discount",
    keywordId: "gold",
    name: "Buyout",
    description: "Card removal costs 10 less Gold",
    effects: [setEffect("removeCardDiscount", 10)],
  },
  {
    id: "gold-enemy-drop",
    keywordId: "gold",
    name: "Plunder",
    description: "Enemies drop 10% more Gold",
    effects: [setEffect("enemyGoldDropBonus", 0.1)],
  },
  {
    id: "gold-on-wish",
    keywordId: "gold",
    name: "Golden Wish",
    description: "Gain 3 Gold when you Wish",
    effects: [setEffect("goldOnWish", 3)],
  },
  {
    id: "gold-mix-discount",
    keywordId: "gold",
    name: "Alchemy Discount",
    description: "Mix Potions costs 10 less Gold",
    effects: [setEffect("mixPotionDiscount", 10)],
  },
  {
    id: "gold-elite-drop",
    keywordId: "gold",
    name: "Spoils of War",
    description: "Elites drop 10% more Gold",
    effects: [setEffect("eliteGoldDropBonus", 0.1)],
  },

  // --- Holy ---
  {
    id: "holy-lifesteal",
    keywordId: "holy",
    name: "Blessed Leech",
    description: "Holy damage heals you for 10% of the amount dealt",
    effects: [setEffect("holyLifestealPercent", 10)],
  },
  {
    id: "holy-first-free",
    keywordId: "holy",
    name: "Divine Favor",
    description: "Your first Holy card each combat is free",
    effects: [setEffect("firstHolyCardFree", true)],
  },
  {
    id: "holy-gold-scaling",
    keywordId: "holy",
    name: "Prosperity",
    description: "Holy damage is increased by 3% of your Gold",
    effects: [setEffect("holyGoldPercent", 3)],
  },
  {
    id: "holy-burn-chance",
    keywordId: "holy",
    name: "Scorching Light",
    description: "Holy damage has a 10% chance to Burn",
    effects: [setEffect("holyBurnChance", 10)],
  },
  {
    id: "holy-half-damage",
    keywordId: "holy",
    name: "Celestial Ward",
    description: "Receive half Holy damage",
    effects: [setEffect("receiveHalfHolyDamage", true)],
  },
  {
    id: "holy-block-scaling",
    keywordId: "holy",
    name: "Faith Barrier",
    description: "Holy damage is increased by 10% of your Block",
    effects: [setEffect("holyBlockPercent", 10)],
  },
  {
    id: "holy-wish-chance",
    keywordId: "holy",
    name: "Divine Intervention",
    description: "Holy damage has a 5% chance to Wish",
    effects: [setEffect("holyWishChance", 5)],
  },
  {
    id: "holy-block-grant",
    keywordId: "holy",
    name: "Radiant Guard",
    description: "Holy damage grants Block for 15% of the amount dealt",
    effects: [setEffect("holyBlockPercentFromDamage", 15)],
  },
  {
    id: "holy-vs-burn",
    keywordId: "holy",
    name: "Purge",
    description: "Holy damage is increased by 20% against enemies with Burn",
    effects: [setEffect("holyVsBurnMultiplier", 20)],
  },
  {
    id: "holy-tithe",
    keywordId: "holy",
    name: "Tithe",
    description: "10% chance to gain Gold equal to Holy damage",
    effects: [setEffect("holyGoldChance", 10)],
  },

  // --- Wish ---
  {
    id: "wish-gold",
    keywordId: "wish",
    name: "Golden Opportunity",
    description: "Gain 2 Gold when you Wish",
    effects: [setEffect("goldOnWishAmount", 2)],
  },
  {
    id: "wish-undiscovered",
    keywordId: "wish",
    name: "Discovery",
    description: "Wish can offer cards not yet in your collection",
    effects: [setEffect("wishUndiscoveredCards", true)],
  },
  {
    id: "wish-health",
    keywordId: "wish",
    name: "Vital Wish",
    description: "Gain 2 Health when you Wish",
    effects: [setEffect("healthOnWish", 2)],
  },
  {
    id: "wish-cleanse",
    keywordId: "wish",
    name: "Purifying Wish",
    description: "Remove a harmful status effect when you Wish",
    effects: [setEffect("removeHarmfulStatusOnWish", true)],
  },
  {
    id: "wish-extra-choice",
    keywordId: "wish",
    name: "Generous Wish",
    description: "Wish has a 20% chance to offer an extra card choice",
    effects: [setEffect("wishExtraChoiceChance", 20)],
  },
  {
    id: "wish-draw",
    keywordId: "wish",
    name: "Insight",
    description: "Wish also draws a card",
    effects: [setEffect("wishDrawsCard", true)],
  },
  {
    id: "wish-powerful",
    keywordId: "wish",
    name: "Powerful Wish",
    description: "Wish card numeric values are increased by 1",
    effects: [setEffect("wishCardsUpgraded", true)],
  },
  {
    id: "wish-mana",
    keywordId: "wish",
    name: "Mana from Heaven",
    description: "Gain 1 Mana when you Wish",
    effects: [addEffect("manaOnWish", 1)],
  },
  {
    id: "wish-boon",
    keywordId: "wish",
    name: "Wishful Boon",
    description: "Gain 1 Forge or Armor when you Wish",
    effects: [setEffect("wishBoonChoice", true)],
  },
  {
    id: "wish-desperate",
    keywordId: "wish",
    name: "Desperate Wish",
    description: "Gain 6 Block when you Wish below 30% Health",
    effects: [setEffect("wishBlockBelowHealthPct", 30)],
  },

  // --- Poison ---
  {
    id: "poison-first-free",
    keywordId: "poison",
    name: "Venom Strike",
    description: "Your first Poison card each combat is free",
    effects: [setEffect("firstPoisonCardFree", true)],
  },
  {
    id: "poison-physical-bonus",
    keywordId: "poison",
    name: "Corrosive",
    description: "Enemies with Poison take +1 Physical damage",
    effects: [setEffect("poisonPhysicalBonus", 1)],
  },
  {
    id: "poison-gain-chance",
    keywordId: "poison",
    name: "Virulent",
    description: "Poison has a 10% chance to gain instead of lose a stack",
    effects: [setEffect("poisonGainChance", 10)],
  },
  {
    id: "poison-half-damage",
    keywordId: "poison",
    name: "Toxin Resistance",
    description: "Receive half Poison damage",
    effects: [setEffect("receiveHalfPoisonDamage", true)],
  },
  {
    id: "poison-gold-first",
    keywordId: "poison",
    name: "Toxic Profit",
    description: "The first time you Poison each combat, gain 4 Gold",
    effects: [setEffect("goldOnFirstPoison", 4)],
  },
  {
    id: "poison-heal-reduce",
    keywordId: "poison",
    name: "Necrosis",
    description: "Poison reduces enemy healing by half",
    effects: [setEffect("poisonHalvesHealing", true)],
  },
  {
    id: "poison-stun-chance",
    keywordId: "poison",
    name: "Paralytic Venom",
    description: "Poison has a 10% chance to also Stun",
    effects: [setEffect("poisonStunChance", 10)],
  },
  {
    id: "poison-strip-armor",
    keywordId: "poison",
    name: "Caustic",
    description: "Poison removes 1 Armor",
    effects: [setEffect("poisonStripArmor", true)],
  },
  {
    id: "poison-reduce-damage",
    keywordId: "poison",
    name: "Crippling Toxin",
    description: "Enemies with Poison deal 1 less damage",
    effects: [setEffect("poisonReducesEnemyDamage", 1)],
  },
  {
    id: "poison-leech-chance",
    keywordId: "poison",
    name: "Hemotoxin",
    description: "Poison has a 10% chance to Leech",
    effects: [setEffect("poisonLeechChance", 10)],
  },

  // --- Bleed ---
  {
    id: "bleed-first-free",
    keywordId: "bleed",
    name: "First Blood",
    description: "Your first Bleed card each combat is free",
    effects: [setEffect("firstBleedCardFree", true)],
  },
  {
    id: "bleed-physical-bonus",
    keywordId: "bleed",
    name: "Open Wound",
    description: "Bleed increases Physical damage taken by 1",
    effects: [setEffect("bleedPhysicalBonus", 1)],
  },
  {
    id: "bleed-leech-chance",
    keywordId: "bleed",
    name: "Sanguine",
    description: "Bleed has a 15% chance to Leech",
    effects: [setEffect("bleedLeechChance", 15)],
  },
  {
    id: "bleed-enemy-weak",
    keywordId: "bleed",
    name: "Mortal Wound",
    description: "Bleed reduces enemy healing by half",
    effects: [setEffect("bleedHalvesEnemyHealing", true)],
  },
  {
    id: "bleed-wound-care",
    keywordId: "bleed",
    name: "Wound Care",
    description: "Bleed damage taken is reduced by half",
    effects: [setEffect("receiveHalfBleedDamage", true)],
  },
  {
    id: "bleed-execute",
    keywordId: "bleed",
    name: "Exsanguinate",
    description: "Bleed deals double damage against enemies below 30% Health",
    effects: [setEffect("bleedExecuteThreshold", 30)],
  },
  {
    id: "bleed-desperate",
    keywordId: "bleed",
    name: "Bleeding Out",
    description: "You deal double Bleed damage while below 50% Health",
    effects: [setEffect("bleedDesperateMultiplier", 2)],
  },
  {
    id: "bleed-poison-chance",
    keywordId: "bleed",
    name: "Tainted Wound",
    description: "Bleed has a 10% chance to Poison",
    effects: [setEffect("bleedPoisonChance", 10)],
  },
  {
    id: "bleed-septic-shock",
    keywordId: "bleed",
    name: "Septic Shock",
    description: "Bleed increases Poison damage taken by 1",
    effects: [setEffect("bleedPoisonDamageTakenBonus", 1)],
  },
  {
    id: "bleed-rip-and-tear",
    keywordId: "bleed",
    name: "Rip and Tear",
    description: "Companion Bleed damage is increased by 1",
    effects: [addEffect("companionBleedDamageBonus", 1)],
  },

  // --- Other keywords (placeholders retained for grid completeness) ---
  ...placeholderTalents("leech", "leech-heal", 1, 10),

  {
    id: "freeze-threshold",
    keywordId: "freeze",
    name: "Bitter Cold",
    description: "Freeze threshold reduced by 10%",
    effects: [setEffect("freezeThresholdReduction", 0.1)],
  },
  {
    id: "freeze-double-damage",
    keywordId: "freeze",
    name: "Shatter",
    description: "Frozen enemies take double damage",
    effects: [setEffect("freezeDoubleDamage", true)],
  },
  {
    id: "freeze-start-amount",
    keywordId: "freeze",
    name: "Winter's Grasp",
    description: "At the start of combat, apply 4 Freeze to the enemy",
    effects: [setEffect("startFreeze", 4)],
  },
  {
    id: "freeze-block-grant",
    keywordId: "freeze",
    name: "Frost Ward",
    description: "Gain 6 Block when you Freeze an enemy",
    effects: [setEffect("blockOnFreeze", 6)],
  },
  {
    id: "freeze-companion-bonus",
    keywordId: "freeze",
    name: "Snow Pack",
    description: "Your Companion deals 1 additional damage to Frozen enemies",
    effects: [addEffect("companionVsFrozenBonus", 1)],
  },
  {
    id: "freeze-strip-armor",
    keywordId: "freeze",
    name: "Brittle Armor",
    description: "Frozen enemies lose all Armor",
    effects: [setEffect("freezeStripArmor", true)],
  },
  {
    id: "freeze-half-damage",
    keywordId: "freeze",
    name: "Cold Resistance",
    description: "Freeze damage received is reduced by half",
    effects: [setEffect("receiveHalfFreezeBuildUp", true)],
  },
  {
    id: "freeze-poison-preserve",
    keywordId: "freeze",
    name: "Cryo-preservation",
    description: "Poison stacks on Frozen enemies don't decay",
    effects: [setEffect("freezePreventsPoisonDecay", true)],
  },
  {
    id: "freeze-prevent-scaling",
    keywordId: "freeze",
    name: "Glacial Encasement",
    description: "Frozen enemies cannot gain Forge or Armor",
    effects: [setEffect("freezePreventsEnemyScaling", true)],
  },
  {
    id: "freeze-block-healing",
    keywordId: "freeze",
    name: "Permafrost",
    description: "Frozen enemies cannot restore Health",
    effects: [setEffect("freezeBlocksRegen", true)],
  },

  ...placeholderTalents("mana", "mana-max", 1, 10),

  ...placeholderTalents("nature", "nature-placeholder", 1, 10),

  {
    id: "companion-damage",
    keywordId: "companion",
    name: "Feral Strength",
    description: "Increase Companion damage by 1",
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-gold-find",
    keywordId: "companion",
    name: "Scavenger",
    description: "Companions sometimes find Gold after combat",
    effects: [setEffect("companionGoldFindActive", true)],
  },
  ...placeholderTalents("companion", "companion-placeholder", 3, 10),

  {
    id: "trap-damage",
    keywordId: "trap",
    name: "Tripwire",
    description: "Increase Trap damage by 1",
    effects: [addEffect("flatTrapDamage", 1)],
  },
  ...placeholderTalents("trap", "trap-placeholder", 2, 10),
];

// Filter helpers for the talent selection UI.
export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

// Returns the next N unlockable talents in pool order (top-to-bottom, left-to-right).
export function sampleTalentChoices(
  keywordId: KeywordId,
  unlockedIds: string[],
  count: number = 1,
): TalentDefinition[] {
  return getTalentsForKeyword(keywordId)
    .filter((t) => !unlockedIds.includes(t.id))
    .slice(0, count);
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;

// Safe default manifest with all zero/false/null values.
// New TalentEffectManifest fields must be added here.
const DEFAULT_TALENT_EFFECTS: TalentEffectManifest = {
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
  blockReduceBurnDamage: 0,
  blockDepletedHeal: 0,
  blockToHolyDamage: false,
  blockToStunDamage: false,

  startForge: 0,
  forgeToBurn: false,
  forgeToHoly: false,
  forgeToBlock: false,
  forgeToBleed: false,
  forgeBurnThreshold: 0,
  forgeBurnDamage: 0,
  forgeStripArmorThreshold: 0,
  flatForgeGained: 0,
  forgeDoubledBelowHalfHealth: false,
  forgeBlockThreshold: 0,
  forgeBlockAmount: 0,

  armorMitigatesBurn: false,
  armorBlockThreshold: 0,
  armorBlockAmount: 0,
  armorDoubledBelowHalfHealth: false,
  firstArmorCardDoubled: false,
  startArmor: 0,
  armorMitigatesBleed: false,
  armorBreakBlock: 0,
  armorMitigatesStun: false,
  armorCleanseThreshold: 0,
  flatArmorAmount: 0,

  campfireHealBonus: 0,
  healthThresholdBlock: null,
  maxHealthPerCombat: 0,
  startHealth: 0,
  healMultiplier: 1,
  healthThresholdArmor: null,
  overhealToBlockRatio: 0,
  healOnStatusCleanse: 0,
  deathsDoorExtension: 0,
  damageReduction: 0,

  firstBurnCardDoubled: false,
  burnRemovesEnemyArmor: false,
  burnDoubleChance: 0,
  receiveHalfBurnDamage: false,
  flatBurnDamage: 0,
  forgeOnPlayerBurnDamage: 0,
  burnReducesEnemyDamage: 0,
  burnOnConsumeAmount: 0,
  forgeOnBurnTickWithBlock: 0,
  burnOnWish: 0,

  shopCardDiscount: 0,
  shopFreeRefresh: false,
  startGold: 0,
  goldPerCombat: 0,
  potionDiscount: 0,
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
  holyGoldChance: 0,

  goldOnWishAmount: 0,
  wishUndiscoveredCards: false,
  healthOnWish: 0,
  removeHarmfulStatusOnWish: false,
  wishExtraChoiceChance: 0,
  wishDrawsCard: false,
  manaOnWish: 0,
  wishBoonChoice: false,
  wishBlockBelowHealthPct: 0,
  wishCardsUpgraded: false,

  firstPoisonCardFree: false,
  poisonPhysicalBonus: 0,
  poisonGainChance: 0,
  receiveHalfPoisonDamage: false,
  goldOnFirstPoison: 0,
  poisonHalvesHealing: false,
  poisonStunChance: 0,
  poisonStripArmor: false,
  poisonReducesEnemyDamage: 0,
  poisonLeechChance: 0,

  companionDamage: 0,
  companionGoldFindActive: false,

  freezeThresholdReduction: 0,
  freezeDoubleDamage: false,
  blockOnFreeze: 0,
  freezeStripArmor: false,
  startFreeze: 0,
  companionVsFrozenBonus: 0,
  freezePreventsPoisonDecay: false,
  freezeBlocksRegen: false,
  freezePreventsEnemyScaling: false,
  receiveHalfFreezeBuildUp: false,

  flatTrapDamage: 0,

  firstBleedCardFree: false,
  bleedPhysicalBonus: 0,
  bleedLeechChance: 0,
  bleedExecuteThreshold: 0,
  bleedDesperateMultiplier: 1,
  bleedPoisonChance: 0,
  bleedPoisonDamageTakenBonus: 0,
  companionBleedDamageBonus: 0,
  receiveHalfBleedDamage: false,
  bleedHalvesEnemyHealing: false,
};

// Returns a manifest with all zero/false/null values — the safe default when no talents are
// unlocked. Deep-copies the nested companionBondLevels to prevent shared mutation.
export function createEmptyTalentManifest(): TalentEffectManifest {
  return {
    ...DEFAULT_TALENT_EFFECTS,
    companionBondLevels: { ...DEFAULT_TALENT_EFFECTS.companionBondLevels },
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
