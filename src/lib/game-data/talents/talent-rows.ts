import { talentFor, add } from "./talent-builder";
const dodge = talentFor("dodge");
const archery = talentFor("archery");
const armor = talentFor("armor");
const bleed = talentFor("bleed");
const block = talentFor("block");
const burn = talentFor("burn");
const companion = talentFor("companion");
const consume = talentFor("consume");
const forge = talentFor("forge");
const freeze = talentFor("freeze");
const gold = talentFor("gold");
const health = talentFor("health");
const holy = talentFor("holy");
const leech = talentFor("leech");
const mana = talentFor("mana");
const nature = talentFor("nature");
const physical = talentFor("physical");
const poison = talentFor("poison");
const stun = talentFor("stun");
const wish = talentFor("wish");

// Preserve row order for seeded offers and progression.
export const talentRows = [
  dodge("dodge-lightfoot", "Lightfoot")("Feather", "+5% Dodge chance", { dodgeChance: add(5) }),
  dodge("dodge-catch-breath", "Catch Breath")("HeartPulse", "Restore 1 Health when you Dodge", { healOnDodge: add(1) }),
  dodge("dodge-feint", "Feint")("Anvil", "When you Dodge, 25% chance to gain 1 Forge", { forgeOnDodge: add(1) }),
  dodge("dodge-thornstep", "Thornstep")("Leaf", "Gain 1 Thorns when you Dodge", { thornsOnDodge: add(1) }),
  dodge("dodge-clean-getaway", "Clean Getaway")(
    "Eraser",
    "When you Dodge, remove 1 stack each of Burn, Poison, and Bleed from yourself",
    { cleanseStacksOnDodge: add(1) },
  ),
  dodge("dodge-open-flank", "Open Flank")(
    "Swords",
    "When you Dodge, your next attack deals 2 additional Physical damage",
    { nextAttackPhysicalOnDodge: add(2) },
  ),
  dodge("dodge-unburdened", "Unburdened")("ShieldOff", "When you Dodge, cleanse your Stun and Freeze buildup", {
    cleanseCcOnDodge: true,
  }),
  dodge("dodge-rolling-recovery", "Tailwind")("ShieldHalf", "When you Dodge, draw a card", { drawOnDodge: 1 }),
  dodge("dodge-finding-rhythm", "Finding Rhythm")(
    "Activity",
    "Taking damage increases your Dodge chance by 5%, resetting when you Dodge",
    { dodgeChanceOnHostileDamage: add(5) },
  ),
  dodge("dodge-perfect-timing", "Perfect Timing")("Shield", "When you Dodge without Armor, gain 2 Armor", {
    armorOnDodge: add(2),
  }),
  archery("archery-damage", "Arrow Dance")("Move", "When you Dodge, your next Archery card is free", {
    nextArcheryCardFreeOnDodge: true,
  }),
  archery("archery-hail", "Follow-through")(
    "CloudRain",
    "Your second Archery card each turn deals 1 additional damage",
    { archerySecondCardDamage: 1 },
  ),
  archery("archery-eagle-eye", "Eagle Eye")(
    "Eye",
    "Your first Archery card against a Stunned enemy each turn draws a card",
    { drawOnArcheryVsStunned: 1 },
  ),
  archery("archery-hawk-eye", "Hawk Eye")(
    "ScanEye",
    "Freezing or Stunning an enemy causes your next attack to Critically Hit",
    { archeryCritOnCrowdControl: true },
  ),
  archery("archery-longshot", "Opening Shot")(
    "ArrowRight",
    "Archery deals double damage against enemies at full Health",
    { archeryDoubledVsHighHealth: true },
  ),
  archery("archery-piercing-shot", "Piercing Shot")("Aperture", "Archery cards ignore 1 Armor", {
    archeryArmorPiercing: add(1),
  }),
  archery("archery-quickdraw", "Skirmisher")("Zap", "Archery deals 1 additional damage while you have no Block", {
    archeryDamageWithoutBlock: 1,
  }),
  archery("archery-kill-shot", "Kill Shot")(
    "Crosshair",
    "Archery cards deal double damage against enemies below 20% Health",
    { archeryDoubledVsLowHealth: true },
  ),
  archery("archery-broadhead", "Broadhead")(
    "Diamond",
    "Archery hits have a 10% chance to deal a quarter of their damage as Bleed damage",
    { archeryBleedDamageChance: 10 },
  ),
  archery("archery-trophy-shot", "Trophy Shot")("Award", "Gain 2 Gold when an Archery card defeats an enemy", {
    goldOnArcheryKill: 2,
  }),
  armor("armor-desperate-double", "Last Stand")("HeartCrack", "Gain 25% more Armor while below half Health", {
    armorLowHealthBonusPercent: 25,
  }),
  armor("armor-block-burst", "Armored Surge")("Shield", "Playing a Block card has a 10% chance to grant 6 Armor", {
    armorOnBlockCardChance: 10,
    armorOnBlockCard: 6,
  }),
  armor("armor-burn-mitigate", "Fireward")("Flame", "Armor mitigates Burn damage taken", { armorMitigatesBurn: true }),
  armor("armor-break-block", "Reactive Guard")("ShieldPlus", "When Armor breaks, gain 3 Block", { armorBreakBlock: 3 }),
  armor("armor-start-combat", "Bulwark")("Square", "Start each combat with 2 Armor", { startArmor: 2 }),
  armor("armor-mitigate-bleed", "Thick Hide")("Hexagon", "Armor mitigates Bleed damage taken", {
    armorMitigatesBleed: true,
  }),
  armor("armor-first-double", "Iron Guard")(
    "Lock",
    "Dealing Physical damage has a 10% chance to also grant that amount of Armor",
    { armorOnPhysicalDamageChance: 10 },
  ),
  armor("armor-mitigate-stun", "Steadfast")("Anchor", "When your Health falls below half, gain 3 Armor", {
    healthThresholdArmor: [{ threshold: 50, amount: 3 }],
  }),
  armor("armor-cleanse-threshold", "Purification")(
    "Sparkles",
    "Gaining Armor has a 10% chance to Cleanse a harmful status effect",
    { armorCleanseChance: 10 },
  ),
  armor("armor-flat-bonus", "Reinforced")("Plus", "10% chance to double Armor gained", { armorDoubleChance: 10 }),
  bleed("bleed-first-free", "First Blood")(
    "Swords",
    "Bleed hits deal 25% more damage against enemies that were not already Bleeding",
    { bleedUnwoundedBonusPercent: 25 },
  ),
  bleed("bleed-physical-bonus", "Parting Cut")(
    "Slash",
    "After you Dodge, your next Physical hit deals half its damage as additional Bleed damage",
    { partingCutDamagePercent: 50 },
  ),
  bleed("bleed-leech-chance", "Sanguine")("HeartPulse", "Bleed hits have a 10% chance to Leech", {
    bleedLeechChance: 10,
  }),
  bleed("bleed-enemy-weak", "Mortal Wound")("Bone", "Enemies restore half as much Health while they are Bleeding", {
    bleedHalvesEnemyHealing: true,
  }),
  bleed("bleed-wound-care", "Wound Care")("Bandage", "Take half Bleed damage", { receiveHalfBleedDamage: true }),
  bleed("bleed-execute", "Flay")("Scissors", "Bleed hits have a 20% chance to halve enemy Armor", {
    bleedHalveArmorChance: 20,
  }),
  bleed("bleed-desperate", "Bleeding Out")("HeartCrack", "Deal 25% more Bleed damage while below half Health", {
    bleedDesperateMultiplier: 1.25,
  }),
  bleed("bleed-poison-chance", "Tainted Wound")(
    "FlaskConical",
    "Bleed hits have a 10% chance to deal half their damage as Poison damage",
    { bleedPoisonDamageChance: 10 },
  ),
  bleed("bleed-septic-shock", "Septic Shock")("TriangleAlert", "Bleeding enemies take 10% more Poison damage", {
    bleedPoisonDamageTakenPercent: 10,
  }),
  bleed("bleed-rip-and-tear", "Bloodrush")("Scissors", "Dealing Bleed damage has a 10% chance to draw a card", {
    drawOnBleedDamageChance: 10,
  }),
  block("block-depleted-heal", "Second Wind")("Wind", "When Block is depleted, restore 1 Health", {
    blockDepletedHeal: 1,
  }),
  block("block-absorb-physical", "Reinforce")("ShieldCheck", "Block absorbs 10% more Physical damage", {
    blockAbsorbPhysicalBonus: 10,
  }),
  block("block-to-holy", "Sacred Shield")("Sun", "Holy damage is increased by 10% of your Block", {
    blockHolyDamagePercent: 10,
  }),
  block("block-to-stun", "Impact Guard")("Zap", "Stun damage is increased by 10% of your Block", {
    blockStunDamagePercent: 10,
  }),
  block("block-prevent-stun", "Grounding")("Anchor", "While you have Block, prevent Stun buildup", {
    blockPreventsStun: true,
  }),
  block("block-to-physical", "Weighted Guard")("Weight", "Physical damage is increased by 10% of your Block", {
    blockToPhysicalDamageMultiplier: add(0.1),
  }),
  block("block-reduce-burn", "Sun-Struck Shield")(
    "Flame",
    "When attacks deplete your Block, reflect 30% of Block lost as Holy damage",
    { holyReflectionBlockLostPercent: 30 },
  ),
  block("block-start", "Footwork")("ChevronsUp", "Gain 2 Block when you Dodge", { dodgeBlockAmount: 2 }),
  block("block-prevent-bleed", "Blood Ward")("Droplets", "Take half Bleed damage while you have Block", {
    blockHalvesBleedDamage: true,
  }),
  block("block-prevent-poison", "Venom Ward")("FlaskConical", "Take half Poison damage while you have Block", {
    blockHalvesPoisonDamage: true,
  }),
  burn("burn-dmg-1", "Flashpoint")("Thermometer", "Your first Burn card each combat costs no mana", {
    firstBurnCardFree: true,
  }),
  burn("burn-dmg-2", "Thermal Vent")("WavesArrowUp", "Burn cards have a 10% chance to grant 1 Forge", {
    forgeOnBurnCard: 1,
    forgeOnBurnCardChance: 10,
  }),
  burn("burn-dmg-5", "Smoke Screen")("Shield", "When you Dodge a Burning enemy, deal 2 Burn damage", {
    burnOnDodgeBurning: 2,
  }),
  burn("burn-dmg-4", "Combustible")("Bomb", "10% chance to detonate Burn when you Consume", {
    consumeDetonatesBurnChance: 10,
  }),
  burn("burn-first-double", "Flash Fire")("TrendingUp", "Burn cards have a 10% chance to play twice", {
    burnCardPlayTwiceChance: 10,
  }),
  burn("burn-remove-armor", "Melting Point")("Droplets", "Burn hits remove enemy Armor equal to the damage dealt", {
    burnRemovesEnemyArmor: true,
  }),
  burn("burn-dmg-3", "Heat Exhaustion")("TrendingDown", "Burn hits have a 10% chance to also deal Stun damage", {
    burnStunChance: 10,
  }),
  burn("burn-dmg-6", "Burning Wish")("Sparkles", "When you Wish, deal 1 Burn damage to the enemy", { burnOnWish: 1 }),
  burn("burn-double-chance", "Smoldering")("Wind", "Burn has a 10% chance to not decay", {
    burnPreventDecayChance: 10,
  }),
  burn("burn-half-damage", "Fire Resistance")("ShieldCheck", "Take half Burn damage", { receiveHalfBurnDamage: true }),
  companion("companion-damage", "Feral Strength")("Bone", "Increase Companion damage by 1", {
    companionDamage: add(1),
  }),
  companion("companion-gold-find", "Fetch")("Trash", "Win a combat with a Companion to gain 3 additional Gold", {
    companionVictoryGold: 3,
  }),
  companion("companion-leech", "Leech Companion")("HeartPulse", "Companions have a 10% chance to Leech", {
    companionLeechChance: 10,
  }),
  companion("companion-hunters-bond", "Hunter's Bond")(
    "Link2",
    "The first Companion card you play each turn draws a card",
    { drawOnCompanionCard: 1 },
  ),
  companion("companion-predator-instinct", "Predator's Instinct")(
    "Eye",
    "Companions deal double damage against enemies below 30% Health",
    { companionDoubledVsLowHealth: true },
  ),
  companion("companion-tame", "Coordinated Strike")(
    "Hand",
    "When you play a Physical card, your Companion’s next attack deals 1 additional damage",
    { companionNextAttackOnPhysical: 1 },
  ),
  companion("companion-loyal", "Pack Reflexes")("PawPrint", "Dodging gives your Companion a 50% chance to act", {
    companionAttacksOnDodge: true,
  }),
  companion("companion-watchdog", "Watchdog")(
    "ShieldAlert",
    "When an enemy attack depletes your Block while you're below half Health, your Companion acts",
    { companionAttackOnBlockDepletedBelowHalf: true },
  ),
  companion("companion-takedown", "Takedown")(
    "Ban",
    "Companion attacks have a 10% chance to deal Stun damage equal to their damage",
    { companionStunChance: 10 },
  ),
  companion("companion-whistle", "Whistle")(
    "Bell",
    "After you play a Companion card, your active Companion acts immediately",
    { companionActsOnCard: true },
  ),
  consume("consume-gourmand", "Gourmand")("Apple", "Consume cards restore 20% more Health", {
    consumeHealMultiplier: 0.2,
  }),
  consume("consume-last-supper", "Last Supper")("Gift", "10% chance to gain 1 Forge when you Consume", {
    forgeOnConsume: 1,
    forgeOnConsumeChance: 10,
  }),
  consume("consume-volatility", "Volatility")("Flame", "Consume cards deal 20% more damage", {
    consumeDamageBonusPercent: 20,
  }),
  consume("consume-distillation", "Distillation")("FlaskConical", "Potions you Consume are 10% more potent", {
    potionPotency: add(0.1),
  }),
  consume("consume-brewmaster", "Brewmaster")("Wine", "Mixed Potions you Consume are 10% more potent", {
    mixedPotionPotency: add(0.1),
  }),
  consume("consume-aftertaste", "Aftertaste")("Cookie", "Restore 1 Health when you Consume", { healOnConsume: 1 }),
  consume("consume-leftovers", "Leftovers")("Package", "10% chance to gain 4 Gold when you Consume", {
    goldOnConsume: 4,
    goldOnConsumeChance: 10,
  }),
  consume("consume-second-helping", "Second Helping")("CopyPlus", "10% chance to draw a card when you Consume", {
    drawOnConsume: 1,
    drawOnConsumeChance: 10,
  }),
  consume("consume-rotgut", "Rotgut")("FlaskRound", "Your Poison Potions deal 2 additional Poison damage", {
    poisonDamageOnConsume: 2,
  }),
  consume("consume-feast", "Feast")("CookingPot", "Apple and Bread restore twice as much Health", {
    cardHealMultipliers: { apple: 1, bread: 1 },
  }),
  forge("forge-to-burn", "Ignite")("Flame", "Burn damage is increased by 25% of your Forge", {
    forgeBurnDamagePercent: 25,
  }),
  forge("forge-to-holy", "Sanctify")("Sun", "Holy damage is increased by 25% of your Forge", {
    forgeHolyDamagePercent: 25,
  }),
  forge("forge-to-block", "Tempered Guard")("Shield", "Block gained is increased by 15% of your Forge", {
    forgeBlockPercent: 15,
  }),
  forge("forge-burn-burst", "Overheat")(
    "Thermometer",
    "While Burning, gaining Forge has a 25% chance to grant 1 additional Forge",
    { forgeBurningBonusChance: 25 },
  ),
  forge("forge-strength-1", "Forge Mastery")("FlameKindling", "Start each combat with 1 Forge", { startForge: 1 }),
  forge("forge-strength-2", "Rust")("Eraser", "Bleed damage is increased by 25% of your Forge", {
    forgeBleedDamagePercent: 25,
  }),
  forge("forge-strength-3", "Sunder")("ShieldOff", "Physical attacks remove Armor equal to half your Forge", {
    physicalStripArmorByForge: true,
  }),
  forge("forge-strength-4", "Intensify")("ChevronsUp", "Gaining Forge has a 10% chance to grant 1 additional Forge", {
    forgeBonusChance: 10,
  }),
  forge("forge-strength-5", "Desperate Forge")(
    "HeartCrack",
    "Below half Health, gaining Forge has a 25% chance to grant 1 additional Forge",
    { forgeLowHealthBonusChance: 25 },
  ),
  forge("forge-strength-6", "Forged Bulwark")("Castle", "Gain 1 Forge when an enemy attack depletes your Block", {
    forgeOnBlockDepleted: 1,
  }),
  freeze("freeze-threshold", "Bitter Cold")(
    "ThermometerSnowflake",
    "Enemy Freeze threshold is reduced by 10 percentage points",
    { freezeThresholdReduction: 0.1 },
  ),
  freeze("freeze-double-damage", "Brittle Ice")("Split", "Frozen enemies take 1 additional damage", {
    freezeDamageBonusVsFrozen: 1,
  }),
  freeze("freeze-start-amount", "Winter's Grasp")("MountainSnow", "Freeze cards have a 10% chance to play twice", {
    freezeCardPlayTwiceChance: 10,
  }),
  freeze("freeze-block-grant", "Icebound")("Snowflake", "When you Freeze an enemy, remove all its Block", {
    freezeStripBlock: true,
  }),
  freeze("freeze-companion-bonus", "Snow Pack")(
    "CloudSnow",
    "Companions deal 1 additional damage against Frozen enemies",
    { companionVsFrozenBonus: 1 },
  ),
  freeze("freeze-strip-armor", "Brittle Armor")("ShieldOff", "When you Freeze an enemy, remove all its Armor", {
    freezeStripArmor: true,
  }),
  freeze("freeze-half-damage", "Cold Resistance")("Thermometer", "Take half Freeze damage", {
    receiveHalfFreezeDamage: true,
  }),
  freeze("freeze-poison-preserve", "Cryo-preservation")("FlaskConical", "Poison does not decay on Frozen enemies", {
    freezePreventsPoisonDecay: true,
  }),
  freeze("freeze-prevent-scaling", "Thaw Dividend")("Hexagon", "When an enemy recovers from Freeze, draw a card", {
    drawOnThaw: 1,
  }),
  freeze("freeze-block-healing", "Glacial Barrier")("Lock", "When you Freeze an enemy, gain 3 Block", {
    blockOnFreeze: 3,
  }),
  gold("gold-shop-discount", "Haggle")("Tag", "Shop purchases cost 5 less Gold", { shopCardDiscount: 5 }),
  gold("gold-shop-refresh", "Restock")("RefreshCw", "Shop refreshes have a 10% chance to be free, once per shop", {
    shopFreeRefreshChance: 10,
  }),
  gold("gold-start", "Seed Money")("Sprout", "Dealing Nature damage has a 10% chance to also grant Gold", {
    goldOnNatureDamageChance: 10,
  }),
  gold("gold-per-combat", "Lucky Foot")("CircleDollarSign", "When you Dodge, you have a 10% chance to gain 4 Gold", {
    goldOnDodge: 4,
  }),
  gold("gold-potion-discount", "Apothecary Membership")("Beaker", "Potion purchases cost 5 less Gold", {
    potionDiscount: 5,
  }),
  gold("gold-remove-discount", "Buyout")("ShoppingCart", "Card removal costs 10 less Gold", { removeCardDiscount: 10 }),
  gold("gold-enemy-drop", "Plunder")("HandCoins", "Enemies drop 10% more Gold", { enemyGoldDropBonus: 0.1 }),
  gold("gold-on-wish", "Golden Wish")("Sparkles", "10% chance to gain 7 Gold when you Wish", {
    goldOnWish: 7,
    goldOnWishChance: 10,
  }),
  gold("gold-mix-discount", "Alchemy Discount")("FlaskConical", "Brewing Potions costs 10 less Gold", {
    mixPotionDiscount: 10,
  }),
  gold("gold-elite-drop", "Coinmail")("Trophy", "Gaining Armor has a 10% chance to also grant Gold", {
    goldOnArmorGainChance: 10,
  }),
  health("health-threshold-armor", "Last Resort")(
    "HeartCrack",
    "When your Health falls below 25%, cleanse all harmful status effects",
    { cleanseBelowHealthPercent: 25 },
  ),
  health("health-threshold-block", "Desperate Guard")(
    "Shield",
    "The first time your Health falls below half each combat, gain 6 Block",
    { healthThresholdBlockOnce: { threshold: 50, amount: 6 } },
  ),
  health("health-max-4", "Will to Live")("Activity", "Death's Door lasts 1 turn longer", { deathsDoorExtension: 1 }),
  health("health-start", "Combat Surge")("ChevronsUp", "Restore 4 Health at the start of combat", { startHealth: 4 }),
  health("health-max-per-combat", "Vitality")("TrendingUp", "Restore 4 Health after every combat", {
    healthRestorePerCombat: 4,
  }),
  health("health-heal-boost", "Mending")("HeartPulse", "Health restored in combat is increased by 10%", {
    healMultiplier: 1.1,
  }),
  health("health-max-1", "Overflow")("Container", "Gain 25% of excess healing from cards as Block", {
    overhealToBlockRatio: 0.25,
  }),
  health("health-max-2", "Renewal")("Sparkles", "Cleansing a harmful status restores 2 Health", {
    healOnStatusCleanse: 2,
  }),
  health("health-max-3", "Last Gasp")("ShieldHalf", "While below half Health, gain 10% Dodge chance", {
    dodgeChanceBelowHalfHealth: 10,
  }),
  health("health-campfire", "Clean Slate")(
    "Flame",
    "When a card restores Health beyond your maximum, cleanse a harmful status effect",
    { cleanseOnCardOverheal: true },
  ),
  holy("holy-block-scaling", "Faith Barrier")(
    "Shield",
    "Holy damage has a 10% chance to grant Block equal to enemy Health lost",
    { holyBlockChance: 10 },
  ),
  holy("holy-half-damage", "Celestial Ward")("ShieldCheck", "Take half Holy damage", { receiveHalfHolyDamage: true }),
  holy("holy-vs-burn", "Purge")("Eraser", "Holy damage is increased by 10% against Burning enemies", {
    holyVsBurnMultiplier: 10,
  }),
  holy("holy-first-free", "Divine Favor")(
    "Gift",
    "When you cleanse a harmful status effect, your next Holy card is free",
    { nextHolyFreeOnCleanse: true },
  ),
  holy("holy-gold-scaling", "Prosperity")("TrendingUp", "Holy damage is increased by 1% of your Gold", {
    holyGoldPercent: 1,
  }),
  holy("holy-burn-chance", "Scorching Light")("Flame", "Holy damage has a 10% chance to also deal Burn damage", {
    holyBurnDamageChance: 10,
  }),
  holy("holy-tithe", "Tithe")("Cross", "Holy damage has a 10% chance to grant Gold equal to enemy Health lost", {
    holyGoldChance: 10,
  }),
  holy("holy-block-grant", "Radiant Guard")("ShieldPlus", "Gaining Block has a 10% chance to draw a Holy card", {
    drawHolyOnBlockChance: 10,
  }),
  holy("holy-lifesteal", "Blessed Leech")("HeartPulse", "Holy card hits gain Leech while you're below half Health", {
    holyLifestealPercent: 50,
  }),
  holy("holy-wish-chance", "Divine Intervention")("Sparkles", "Holy damage has a 10% chance to Wish", {
    holyWishChance: 10,
  }),
  leech("leech-first-double", "Deep Siphon")("Sword", "Leech restores 1 additional Health", { leechHealingBonus: 1 }),
  leech("leech-blood-debt", "Blood Debt")(
    "CircleDollarSign",
    "Leech has a 10% chance to also grant Gold equal to Health restored",
    { leechGoldChance: 10 },
  ),
  leech("leech-nature-chance", "Affliction Siphon")(
    "Utensils",
    "Leech restores 10% more Health against Poisoned or Bleeding enemies",
    { afflictionLeechBonusPercent: 10 },
  ),
  leech("leech-desperate", "Desperate Siphon")("HeartCrack", "Leech is doubled while you're below half Health", {
    leechDesperateMultiplier: 100,
  }),
  leech("leech-cull-weak", "Cull the Weak")(
    "Skull",
    "Leech cards deal 25% more damage against enemies below half Health",
    { leechCardDamageVsLowHealthPercent: 25 },
  ),
  leech("leech-block-enemy", "Sanguine Overflow")("Hash", "When Leech fills your Health, gain 1 Mana", {
    manaOnLeechToFull: 1,
  }),
  leech("leech-bleed-chance", "Bloodletting")("Droplets", "Leech has a 10% chance to cleanse a harmful status", {
    leechCleanseChance: 10,
  }),
  leech("leech-mana-siphon", "Mana Siphon")("Gem", "Leech has a 10% chance to gain 1 Mana", { manaOnLeechChance: 10 }),
  leech("leech-trinket-siphon", "Armor Siphon")(
    "Wrench",
    "Your Leech cards steal 1 Armor before their effects resolve",
    { armorStealOnLeechCard: 1 },
  ),
  leech("leech-poison", "Virulent Leech")("FlaskConical", "Poison damage has a 10% chance to Leech", {
    poisonLeechChance: 10,
  }),
  mana("mana-wellspring", "Wellspring")("Droplets", "When you end your turn with unspent Mana, keep 1 for next turn", {
    wellspringKeepMana: 1,
  }),
  mana("mana-bulwark", "Mana Bulwark")("ShieldPlus", "Start each combat with Block equal to your Mana Crystals", {
    manaBulwarkActive: true,
  }),
  mana("mana-leylines", "Leyline Attunement")("Atom", "Gain 1 Mana Crystal", { startMana: 1 }),
  mana("mana-arcane-wish", "Dark Recovery")("Sparkles", "End your turn with no Mana to gain 1 extra Mana next turn", {
    manaAfterEmptyTurn: 1,
  }),
  mana("mana-manaburn", "Manaburn")("Flame", "Burn damage is increased by 25% of your Mana", { burnDamagePerMana: 25 }),
  mana("mana-arcane-frost", "Arcane Frost")("Snowflake", "Freeze damage is increased by 25% of your Mana", {
    freezeDamagePerMana: 25,
  }),
  mana("mana-flare", "Mana Flare")("Bomb", "When you lose a Mana Crystal, deal 3 Burn damage", {
    burnDamageOnManaCrystalLoss: 3,
  }),
  mana("mana-familiar-bond", "Familiar Bond")("PawPrint", "Companion damage has a 10% chance to gain 1 Mana", {
    companionManaChance: 10,
  }),
  mana("mana-shell", "Mana Shell")("ShieldHalf", "Start each combat with Armor equal to your Mana Crystals", {
    manaShellActive: true,
  }),
  mana("mana-arcane-mending", "Arcane Mending")("Wand", "Restore 1 Health per Mana gained", { healthPerMana: 1 }),
  nature("nature-overgrowth", "Overgrowth")("TrendingUp", "Nature cards have a 10% chance to play twice", {
    natureCardPlayTwiceChance: 10,
  }),
  nature("nature-thornskin", "Thornskin")("Hexagon", "Nature damage has a 10% chance to also grant Armor", {
    armorOnNatureDamageChance: 10,
  }),
  nature("nature-natural-armor", "Bramblegrowth")("Shield", "Nature damage has a 10% chance to also grant Thorns", {
    thornsOnNatureDamageChance: 10,
  }),
  nature("nature-photosynthesis", "Photosynthesis")("Leaf", "Nature damage has a 10% chance to also restore Health", {
    healOnNatureDamageChance: 10,
  }),
  nature("nature-canopy", "Windstep")("Feather", "When you Dodge, your next Nature card is free", {
    nextNatureCardFreeOnDodge: true,
  }),
  nature("nature-briar-patch", "Briar Patch")("Triangle", "Nature damage has a 10% chance to also Bleed", {
    natureBleedChance: 10,
  }),
  nature("nature-toxic-pollen", "Toxic Pollen")("Wind", "Nature damage has a 10% chance to also Poison", {
    naturePoisonChance: 10,
  }),
  nature("nature-verdant-cycle", "Verdant Cycle")("RotateCw", "Nature damage has a 10% chance to Leech", {
    natureLeechChance: add(10),
  }),
  nature("nature-ecosystem", "Ecosystem")("Network", "Draw a Nature card at the start of combat", {
    drawNatureCardAtCombatStart: true,
  }),
  nature("nature-entangle", "Entangle")("Link", "Nature damage has a 10% chance to also deal Stun damage", {
    natureStunChance: 10,
  }),
  physical("physical-expert-blacksmith", "Expert Blacksmith")(
    "Anvil",
    "Physical damage bonus from Forge is increased by 25%",
    { forgeToPhysicalDamageMultiplier: 1.25 },
  ),
  physical("physical-shield-bash", "Shield Slam")("Shield", "Physical damage is increased by half your Block", {
    blockToPhysicalDamageMultiplier: add(0.5),
  }),
  physical("physical-armored-fists", "Armored Fists")("HandFist", "Physical damage is increased by half your Armor", {
    armorPhysicalDamagePercent: 50,
  }),
  physical("physical-heavy-blows", "Heavy Blows")(
    "Hammer",
    "Physical damage has a 10% chance to also deal Stun damage",
    {
      physicalStunChance: 10,
    },
  ),
  physical("physical-finish-him", "Finish Him")(
    "Skull",
    "Physical damage is doubled against enemies below 25% Health",
    { physicalDoubledBelowQuarterHealth: true },
  ),
  physical("physical-shatter", "Icebreaker")(
    "Split",
    "Physical attacks against Frozen enemies have a 25% chance to grant 1 Forge",
    { forgeOnPhysicalVsFrozen: 1, forgeOnPhysicalVsFrozenChance: 25 },
  ),
  physical("physical-lacerate", "Lacerate")("Scissors", "Physical damage has a 10% chance to Bleed", {
    physicalBleedChance: 10,
  }),
  physical("physical-hemorrhage", "Rupture")("Droplets", "Physical critical hits detonate Bleed", {
    physicalDetonatesBleed: true,
  }),
  physical("physical-brute-force", "Riposte")(
    "Swords",
    "After you Dodge, your next Physical attack is guaranteed to Critical Hit",
    { physicalCritOnDodge: true },
  ),
  physical("physical-unrelenting", "Unrelenting")(
    "ShieldCheck",
    "Physical damage is doubled while you're below half Health",
    { physicalDoubledBelowHalfHealth: true },
  ),
  poison("poison-leech-chance", "Hemotoxin")("Biohazard", "Poison has a 10% chance to also deal Bleed damage", {
    poisonBleedDamageChance: 10,
  }),
  poison("poison-physical-bonus", "Corrosive")("Droplets", "Poisoned enemies take 1 additional damage", {
    poisonDamageBonusVsPoisoned: 1,
  }),
  poison("poison-strip-armor", "Caustic")("FlaskRound", "Poison damage removes enemy Armor equal to damage dealt", {
    poisonStripArmorByDamage: true,
  }),
  poison("poison-half-damage", "Toxin Resistance")("Shield", "Take half Poison damage", {
    receiveHalfPoisonDamage: true,
  }),
  poison("poison-gold-first", "Toxic Profit")("Coins", "10% chance to steal 4 Gold when you defeat a Poisoned enemy", {
    goldOnPoisonedKill: 4,
    goldOnPoisonedKillChance: 10,
  }),
  poison("poison-heal-reduce", "Necrosis")("Skull", "Poisoned enemies restore half as much Health", {
    poisonHalvesHealing: true,
  }),
  poison("poison-stun-chance", "Paralytic Venom")("Lock", "Poison damage has a 10% chance to also deal Stun damage", {
    poisonStunChance: 10,
  }),
  poison("poison-gain-chance", "Virulent")("TrendingUp", "Poison has a 10% chance to gain instead of lose a stack", {
    poisonGainChance: 10,
  }),
  poison("poison-reduce-damage", "Torpor")("Moon", "Poisoned enemies cannot Dodge", { poisonPreventsEnemyDodge: true }),
  poison("poison-first-free", "Venom Strike")("Syringe", "Poison cards have a 10% chance to play twice", {
    poisonCardPlayTwiceChance: 10,
  }),
  stun("stun-forge-grant", "Riled Up")("Flame", "Stunning an enemy has a 25% chance to grant 1 Forge", {
    forgeOnStun: 1,
    forgeOnStunChance: 25,
  }),
  stun("stun-double-damage", "Exploit Weakness")("TrendingUp", "Stunned enemies take double damage", {
    stunDoubleDamage: true,
  }),
  stun("stun-block-grant", "Guarded Counter")("Shield", "If you have no Block, Stunning an enemy grants 4 Block", {
    blockOnStun: 4,
  }),
  stun("stun-duration-1", "Extended Stun")("Clock", "Stun effects last 1 turn longer", { stunDurationExtension: 1 }),
  stun("stun-strip-armor", "Shatter Guard")("ShieldOff", "When you Stun an enemy, remove all its Armor", {
    stunStripArmor: true,
  }),
  stun("stun-damage-1", "Jarring Blow")("Bolt", "Stun cards have a 10% chance to play twice", {
    stunCardPlayTwiceChance: 10,
  }),
  stun("stun-next-free", "Free Follow-up")("Gift", "When you Stun an enemy, your next card is free", {
    nextCardFreeOnStun: true,
  }),
  stun("stun-threshold", "Concussive Force")("Waves", "Enemy Stun threshold is reduced by 10 percentage points", {
    stunThresholdReduction: 0.1,
  }),
  stun("stun-draw", "Stun Insight")("Eye", "When you Stun an enemy, draw a card", { drawOnStun: 1 }),
  stun("stun-mana-grant", "Stun Surge")("PlugZap", "If you have no Mana, Stunning an enemy grants 1 Mana", {
    manaOnStun: 1,
  }),
  wish("wish-trinket", "Wishful Trinket")("Gem", "50% chance to gain 1 Forge or Armor when you Wish", {
    wishTrinketChoice: true,
  }),
  wish("wish-undiscovered", "Discovery")("Compass", "Wish always includes an undiscovered card when one is available", {
    wishUndiscoveredCards: true,
  }),
  wish("wish-health", "Vital Wish")("Heart", "Restore 1 Health when you Wish", { healthOnWish: 1 }),
  wish("wish-cleanse", "Purifying Wish")("Sparkle", "Cleanse 1 harmful status effect when you Wish", {
    removeHarmfulStatusOnWish: true,
  }),
  wish("wish-extra-choice", "Generous Wish")("Gift", "Wish cards have a 10% chance to play twice", {
    wishCardPlayTwiceChance: 10,
  }),
  wish("wish-draw", "Insight")("Eye", "Wish has a 10% chance to draw a card", { wishDrawChance: 10 }),
  wish("wish-powerful", "Powerful Wish")("Bolt", "Wish cards are upgraded", { wishCardsUpgraded: true }),
  wish("wish-mana", "Mana from Heaven")("CloudRain", "Wish cards refund their Mana cost", {
    wishCardRefundsMana: true,
  }),
  wish("wish-gold", "Roads Not Taken")("Coins", "Wish has a 10% chance to also grant one of the cards not chosen", {
    declinedWishCardChance: 10,
  }),
  wish("wish-desperate", "Desperate Wish")("HeartCrack", "When you Wish below half Health, gain 2 Block", {
    wishBlockBelowHealthPct: 50,
    wishBlockAmount: 2,
  }),
];
