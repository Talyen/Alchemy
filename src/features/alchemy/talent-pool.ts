import type { KeywordId } from "@/lib/game-data";
import type { TalentEffectManifest } from "@/lib/battle/types";

// A talent definition — just an ID + description. Talent names were removed
// per player feedback; the description is self-explanatory. New talents can be
// added by simply appending to the talentPool array below.
export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  description: string;
}

// The full pool of unlockable talents. Each keyword has exactly 9 talents for a 3x3 grid.
export const talentPool: TalentDefinition[] = [
  // --- Physical ---
  { id: "physical-dmg-1", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-2", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-3", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-first-free", keywordId: "physical", description: "Your first Physical card each combat is free" },
  { id: "physical-vs-stunned", keywordId: "physical", description: "Enemies take 20% more Physical damage when Stunned" },
  { id: "physical-vs-frozen", keywordId: "physical", description: "Enemies take 40% more Physical damage when Frozen" },
  { id: "physical-armor", keywordId: "physical", description: "Physical Damage is increased by your Armor" },
  { id: "physical-crit", keywordId: "physical", description: "Physical Damage has +5% Critical Chance" },
  { id: "physical-dmg-4", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-5", keywordId: "physical", description: "Increase Physical Damage by 1" },

  // --- Stun ---
  { id: "stun-threshold", keywordId: "stun", description: "Stun threshold reduced by 10%" },
  { id: "stun-draw", keywordId: "stun", description: "When you Stun an enemy, draw a card" },
  { id: "stun-next-free", keywordId: "stun", description: "When you Stun an enemy, your next card is free" },
  { id: "stun-duration-1", keywordId: "stun", description: "Stun effects last 1 turn longer" },

  // --- Block ---
  { id: "block-start", keywordId: "block", description: "Start combat with 10 Block" },
  { id: "block-to-physical", keywordId: "block", description: "Increase Physical damage by half your Block" },
  { id: "block-prevent-bleed", keywordId: "block", description: "Block prevents receiving Bleed Ailments" },
  { id: "block-prevent-poison", keywordId: "block", description: "Block prevents receiving Poison Ailments" },
  { id: "block-prevent-stun", keywordId: "block", description: "Block prevents receiving Stun buildup" },
  { id: "block-absorb-physical", keywordId: "block", description: "Block absorbs 20% more Physical damage" },
  { id: "block-amount-1", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-amount-2", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-amount-3", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-amount-4", keywordId: "block", description: "+1 Block when blocking" },

  // --- Forge ---
  { id: "forge-to-burn", keywordId: "forge", description: "Forge also increases Burn damage" },
  { id: "forge-to-holy", keywordId: "forge", description: "Forge also increases Holy damage" },
  { id: "forge-to-block", keywordId: "forge", description: "Forge also increases Block amount" },
  { id: "forge-burn-burst", keywordId: "forge", description: "Upon reaching 4 Forge, deal 8 Burn" },
  { id: "forge-strength-1", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-strength-2", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-strength-3", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-strength-4", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-strength-5", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-strength-6", keywordId: "forge", description: "Forge effects are 1 stronger" },

  // --- Armor ---
  { id: "armor-ailment-reduce", keywordId: "armor", description: "Armor reduces Ailment damage you take by 1" },
  { id: "armor-block-burst", keywordId: "armor", description: "Upon reaching 4 Armor, gain 8 Block" },
  { id: "armor-desperate-double", keywordId: "armor", description: "Armor gained is doubled when Health is below 50%" },
  { id: "armor-first-double", keywordId: "armor", description: "Your first Armor card each combat is doubled" },
  { id: "armor-amount-1", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-amount-2", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-amount-3", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-amount-4", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-amount-5", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-amount-6", keywordId: "armor", description: "+1 Armor gained" },

  // --- Health ---
  { id: "health-campfire", keywordId: "health", description: "Campfire heals 10% more Health" },
  { id: "health-threshold-block", keywordId: "health", description: "When Health drops below 50%, gain 6 Block" },
  { id: "health-max-per-combat", keywordId: "health", description: "Gain 1 Max Health after every combat" },
  { id: "health-start", keywordId: "health", description: "Gain 4 Health at the start of combat" },
  { id: "health-heal-boost", keywordId: "health", description: "Healing effects are 10% stronger" },
  { id: "health-threshold-armor", keywordId: "health", description: "When Health drops below 25%, gain 3 Armor" },
  { id: "health-max-1", keywordId: "health", description: "+5 Max Health" },
  { id: "health-max-2", keywordId: "health", description: "+5 Max Health" },
  { id: "health-max-3", keywordId: "health", description: "+5 Max Health" },
  { id: "health-max-4", keywordId: "health", description: "+5 Max Health" },

  // --- Burn ---
  { id: "burn-first-double", keywordId: "burn", description: "Your first Burn card each combat is doubled" },
  { id: "burn-remove-armor", keywordId: "burn", description: "Burn damage removes that amount of enemy Armor" },
  { id: "burn-double-chance", keywordId: "burn", description: "Burn stacks have a 5% chance to double instead of halve" },
  { id: "burn-half-damage", keywordId: "burn", description: "Receive half Burn damage" },
  { id: "burn-dmg-1", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-dmg-2", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-dmg-3", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-dmg-4", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-dmg-5", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-dmg-6", keywordId: "burn", description: "Burn deals 1 extra damage" },

  // --- Gold ---
  { id: "gold-shop-discount", keywordId: "gold", description: "Shop cards cost 5 less Gold" },
  { id: "gold-shop-refresh", keywordId: "gold", description: "Shop refresh is free once per visit" },
  { id: "gold-start", keywordId: "gold", description: "Start each run with 20 Gold" },
  { id: "gold-per-combat", keywordId: "gold", description: "Gain +5 Gold after each combat" },
  { id: "gold-potion-discount", keywordId: "gold", description: "Potions cost 5 less Gold" },
  { id: "gold-remove-discount", keywordId: "gold", description: "Card removal costs 10 less Gold" },
  { id: "gold-enemy-drop", keywordId: "gold", description: "Enemies drop 10% more Gold" },
  { id: "gold-on-wish", keywordId: "gold", description: "Gain 3 Gold when you Wish" },
  { id: "gold-mix-discount", keywordId: "gold", description: "Mix Potions costs 10 less Gold" },
  { id: "gold-per-combat-extra", keywordId: "gold", description: "Gain +2 Gold after each combat" },

  // --- Holy ---
  { id: "holy-lifesteal", keywordId: "holy", description: "Holy damage heals you for 10% of the amount dealt" },
  { id: "holy-first-free", keywordId: "holy", description: "Your first Holy card each combat is free" },
  { id: "holy-gold-scaling", keywordId: "holy", description: "Holy damage is increased by 3% of your Gold" },
  { id: "holy-burn-chance", keywordId: "holy", description: "Holy damage has a 10% chance to Burn" },
  { id: "holy-half-damage", keywordId: "holy", description: "Receive half Holy damage" },
  { id: "holy-block-scaling", keywordId: "holy", description: "Holy damage is increased by 10% of your Block" },
  { id: "holy-wish-chance", keywordId: "holy", description: "Holy damage has a 5% chance to Wish" },
  { id: "holy-block-grant", keywordId: "holy", description: "Holy damage grants Block for 15% of the amount dealt" },
  { id: "holy-vs-burn", keywordId: "holy", description: "Holy damage is increased by 20% against enemies with Burn" },
  { id: "holy-dmg-1", keywordId: "holy", description: "Holy damage is increased by 1" },

  // --- Wish ---
  { id: "wish-gold", keywordId: "wish", description: "Gain 2 Gold when you Wish" },
  { id: "wish-undiscovered", keywordId: "wish", description: "Wish can offer cards not yet in your collection" },
  { id: "wish-health", keywordId: "wish", description: "Gain 2 Health when you Wish" },
  { id: "wish-cleanse", keywordId: "wish", description: "Remove an Ailment when you Wish" },
  { id: "wish-extra-choice", keywordId: "wish", description: "Wish has a 20% chance to offer an extra card choice" },
  { id: "wish-draw", keywordId: "wish", description: "Wish also draws a card" },
  { id: "wish-choice-1", keywordId: "wish", description: "Wish offers 1 extra choice" },
  { id: "wish-choice-2", keywordId: "wish", description: "Wish offers 1 extra choice" },
  { id: "wish-choice-3", keywordId: "wish", description: "Wish offers 1 extra choice" },
  { id: "wish-choice-4", keywordId: "wish", description: "Wish offers 1 extra choice" },

  // --- Poison ---
  { id: "poison-first-free", keywordId: "poison", description: "Your first Poison card each combat is free" },
  { id: "poison-physical-bonus", keywordId: "poison", description: "Enemies with Poison take +1 Physical damage" },
  { id: "poison-gain-chance", keywordId: "poison", description: "Poison has a 10% chance to gain instead of lose a stack" },
  { id: "poison-half-damage", keywordId: "poison", description: "Receive half Poison damage" },
  { id: "poison-gold-first", keywordId: "poison", description: "The first time you Poison each combat, gain 4 Gold" },
  { id: "poison-heal-reduce", keywordId: "poison", description: "Poison reduces enemy healing by half" },
  { id: "poison-dmg-1", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-dmg-2", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-dmg-3", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-dmg-4", keywordId: "poison", description: "Poison deals 1 extra damage" },

  // --- Bleed ---
  { id: "bleed-first-free", keywordId: "bleed", description: "Your first Bleed card each combat is free" },
  { id: "bleed-physical-bonus", keywordId: "bleed", description: "Bleed increases Physical damage taken by 1" },
  { id: "bleed-leech-chance", keywordId: "bleed", description: "Bleed has a 15% chance to Leech" },
  { id: "bleed-enemy-weak", keywordId: "bleed", description: "Enemies with Bleed deal 1 less damage" },
  { id: "bleed-physical-taken", keywordId: "bleed", description: "Enemies with Bleed take +1 Physical damage" },
  { id: "bleed-execute", keywordId: "bleed", description: "Bleed deals double damage against enemies below 30% Health" },
  { id: "bleed-desperate", keywordId: "bleed", description: "You deal double Bleed damage if you are below 50% Health" },
  { id: "bleed-poison-chance", keywordId: "bleed", description: "Bleed has a 10% chance to Poison" },
  { id: "bleed-dmg-1", keywordId: "bleed", description: "Bleed deals 1 extra damage" },
  { id: "bleed-dmg-2", keywordId: "bleed", description: "Bleed deals 1 extra damage" },

  // --- Other keywords (placeholders retained for grid completeness) ---
  { id: "ailment-duration-1", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-2", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-3", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-4", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-5", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-6", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-7", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-8", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-9", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-duration-10", keywordId: "ailment", description: "Ailments last 1 turn longer" },

  { id: "consume-draw-1", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-2", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-3", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-4", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-5", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-6", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-7", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-8", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-9", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-draw-10", keywordId: "consume", description: "Draw 1 card when a card is consumed" },

  { id: "leech-heal-1", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-2", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-3", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-4", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-5", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-6", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-7", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-8", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-9", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-heal-10", keywordId: "leech", description: "Leech heals for 1 more" },

  { id: "freeze-duration-1", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-2", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-3", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-4", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-5", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-6", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-7", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-8", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-9", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-duration-10", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },

  { id: "mana-max-1", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-2", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-3", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-4", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-5", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-6", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-7", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-8", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-9", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-max-10", keywordId: "mana", description: "+1 Max Mana" },

  { id: "nature-placeholder-1", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-2", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-3", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-4", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-5", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-6", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-7", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-8", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-9", keywordId: "nature", description: "Placeholder Nature talent" },
  { id: "nature-placeholder-10", keywordId: "nature", description: "Placeholder Nature talent" },

  { id: "companion-placeholder-1", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-2", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-3", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-4", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-5", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-6", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-7", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-8", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-9", keywordId: "companion", description: "Placeholder Companion talent" },
  { id: "companion-placeholder-10", keywordId: "companion", description: "Placeholder Companion talent" },

  { id: "trap-placeholder-1", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-2", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-3", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-4", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-5", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-6", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-7", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-8", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-9", keywordId: "trap", description: "Placeholder Trap talent" },
  { id: "trap-placeholder-10", keywordId: "trap", description: "Placeholder Trap talent" },
];

// Filter helpers for the talent selection UI.
export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

function getAvailableTalents(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((t) => !unlockedIds.includes(t.id));
}

// Returns the next N unlockable talents in pool order (top-to-bottom, left-to-right).
export function sampleTalentChoices(keywordId: KeywordId, unlockedIds: string[], count: number = 1): TalentDefinition[] {
  const available = getAvailableTalents(keywordId, unlockedIds);
  return available.slice(0, count);
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;

// Computes the battle effect manifest from the unlocked talent IDs.
export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const physIds = unlockedTalents.physical ?? [];
  const stunIds = unlockedTalents.stun ?? [];
  const blockIds = unlockedTalents.block ?? [];
  const forgeIds = unlockedTalents.forge ?? [];
  const armorIds = unlockedTalents.armor ?? [];
  const healthIds = unlockedTalents.health ?? [];
  const burnIds = unlockedTalents.burn ?? [];
  const goldIds = unlockedTalents.gold ?? [];
  const holyIds = unlockedTalents.holy ?? [];
  const wishIds = unlockedTalents.wish ?? [];
  const poisonIds = unlockedTalents.poison ?? [];
  const bleedIds = unlockedTalents.bleed ?? [];

  return {
    flatPhysicalDamage: physIds.filter((id) => id.startsWith("physical-dmg-")).length,
    armorToPhysicalDamage: physIds.includes("physical-armor"),
    physicalCritChance: physIds.includes("physical-crit") ? 5 : 0,
    firstPhysicalCardFree: physIds.includes("physical-first-free"),
    physicalVsStunnedMultiplier: physIds.includes("physical-vs-stunned") ? 20 : 0,
    physicalVsFrozenMultiplier: physIds.includes("physical-vs-frozen") ? 40 : 0,

    stunThresholdReduction: stunIds.includes("stun-threshold") ? 0.1 : 0,
    drawOnStun: stunIds.includes("stun-draw") ? 1 : 0,
    nextCardFreeOnStun: stunIds.includes("stun-next-free"),
    stunDurationExtension: stunIds.includes("stun-duration-1") ? 1 : 0,

    startBlock: blockIds.includes("block-start") ? 10 : 0,
    blockToPhysicalDamage: blockIds.includes("block-to-physical"),
    blockPreventsBleed: blockIds.includes("block-prevent-bleed"),
    blockPreventsPoison: blockIds.includes("block-prevent-poison"),
    blockPreventsStun: blockIds.includes("block-prevent-stun"),
    blockAbsorbPhysicalBonus: blockIds.includes("block-absorb-physical") ? 20 : 0,

    forgeToBurn: forgeIds.includes("forge-to-burn"),
    forgeToHoly: forgeIds.includes("forge-to-holy"),
    forgeToBlock: forgeIds.includes("forge-to-block"),
    forgeBurnThreshold: forgeIds.includes("forge-burn-burst") ? 4 : 0,
    forgeBurnDamage: forgeIds.includes("forge-burn-burst") ? 8 : 0,

    armorAilmentReduction: armorIds.includes("armor-ailment-reduce") ? 1 : 0,
    armorBlockThreshold: armorIds.includes("armor-block-burst") ? 4 : 0,
    armorBlockAmount: armorIds.includes("armor-block-burst") ? 8 : 0,
    armorDoubledBelowHalfHealth: armorIds.includes("armor-desperate-double"),
    firstArmorCardDoubled: armorIds.includes("armor-first-double"),

    campfireHealBonus: healthIds.includes("health-campfire") ? 0.1 : 0,
    healthThresholdBlock: healthIds.includes("health-threshold-block") ? { threshold: 50, amount: 6 } : null,
    maxHealthPerCombat: healthIds.includes("health-max-per-combat") ? 1 : 0,
    startHealth: healthIds.includes("health-start") ? 4 : 0,
    healMultiplier: healthIds.includes("health-heal-boost") ? 1.1 : 1,
    healthThresholdArmor: healthIds.includes("health-threshold-armor") ? { threshold: 25, amount: 3 } : null,

    firstBurnCardDoubled: burnIds.includes("burn-first-double"),
    burnRemovesEnemyArmor: burnIds.includes("burn-remove-armor"),
    burnDoubleChance: burnIds.includes("burn-double-chance") ? 5 : 0,
    receiveHalfBurnDamage: burnIds.includes("burn-half-damage"),

    shopCardDiscount: goldIds.includes("gold-shop-discount") ? 5 : 0,
    shopFreeRefresh: goldIds.includes("gold-shop-refresh"),
    startGold: goldIds.includes("gold-start") ? 20 : 0,
    goldPerCombat: goldIds.includes("gold-per-combat") ? 5 : 0,
    potionDiscount: goldIds.includes("gold-potion-discount") ? 5 : 0,
    removeCardDiscount: goldIds.includes("gold-remove-discount") ? 10 : 0,
    enemyGoldDropBonus: goldIds.includes("gold-enemy-drop") ? 0.1 : 0,
    goldOnWish: goldIds.includes("gold-on-wish") ? 3 : 0,
    mixPotionDiscount: goldIds.includes("gold-mix-discount") ? 10 : 0,

    holyLifestealPercent: holyIds.includes("holy-lifesteal") ? 10 : 0,
    firstHolyCardFree: holyIds.includes("holy-first-free"),
    holyGoldPercent: holyIds.includes("holy-gold-scaling") ? 3 : 0,
    holyBurnChance: holyIds.includes("holy-burn-chance") ? 10 : 0,
    receiveHalfHolyDamage: holyIds.includes("holy-half-damage"),
    holyBlockPercent: holyIds.includes("holy-block-scaling") ? 10 : 0,
    holyWishChance: holyIds.includes("holy-wish-chance") ? 5 : 0,
    holyBlockPercentFromDamage: holyIds.includes("holy-block-grant") ? 15 : 0,
    holyVsBurnMultiplier: holyIds.includes("holy-vs-burn") ? 20 : 0,

    goldOnWishAmount: wishIds.includes("wish-gold") ? 2 : 0,
    wishUndiscoveredCards: wishIds.includes("wish-undiscovered"),
    healthOnWish: wishIds.includes("wish-health") ? 2 : 0,
    removeAilmentOnWish: wishIds.includes("wish-cleanse"),
    wishExtraChoiceChance: wishIds.includes("wish-extra-choice") ? 20 : 0,
    wishDrawsCard: wishIds.includes("wish-draw"),

    firstPoisonCardFree: poisonIds.includes("poison-first-free"),
    poisonPhysicalBonus: poisonIds.includes("poison-physical-bonus") ? 1 : 0,
    poisonGainChance: poisonIds.includes("poison-gain-chance") ? 10 : 0,
    receiveHalfPoisonDamage: poisonIds.includes("poison-half-damage"),
    goldOnFirstPoison: poisonIds.includes("poison-gold-first") ? 4 : 0,
    poisonHalvesHealing: poisonIds.includes("poison-heal-reduce"),

    firstBleedCardFree: bleedIds.includes("bleed-first-free"),
    bleedPhysicalBonus: bleedIds.includes("bleed-physical-bonus") ? 1 : 0,
    bleedLeechChance: bleedIds.includes("bleed-leech-chance") ? 15 : 0,
    bleedEnemyDamageReduction: bleedIds.includes("bleed-enemy-weak") ? 1 : 0,
    bleedPhysicalTakenBonus: bleedIds.includes("bleed-physical-taken") ? 1 : 0,
    bleedExecuteThreshold: bleedIds.includes("bleed-execute") ? 30 : 0,
    bleedDesperateMultiplier: bleedIds.includes("bleed-desperate") ? 2 : 1,
    bleedPoisonChance: bleedIds.includes("bleed-poison-chance") ? 10 : 0,
  };
}
