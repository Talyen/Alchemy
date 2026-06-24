// Homestead data definitions — buildings, farm plots, and research upgrades.
// Each item has a tiers array (length 1-3) describing the cost and effects
// of each successive upgrade. Items with 3 tiers show stars in the UI.

import {
  defineBuilding,
  defineFarm,
  defineResearch,
  dualMaterialCosts,
  materialCost,
  singleMaterialCosts,
  stackingTiers,
} from "./data-builders";

export const buildings = [
  defineBuilding("blacksmiths-forge", "Blacksmith's Forge", [
    {
      cost: materialCost({ iron: 20 }),
      effects: { flatPhysicalDamage: 1, forgeToBurn: true },
      benefitDescription: "Increases Physical damage dealt by 1\nForge effect also increases Burn damage",
    },
    ...stackingTiers(
      [materialCost({ iron: 30 }), materialCost({ iron: 40 })],
      { flatPhysicalDamage: 1 },
      (tier) => `Increases Physical damage dealt by ${tier + 1}`,
    ),
  ]),
  defineBuilding(
    "hunters-lodge",
    "Hunter's Lodge",
    stackingTiers(
      dualMaterialCosts("wood", "food"),
      { flatArrowDamage: 1, flatNatureDamage: 1, endRunFoodPerRoom: 1 },
      (tier) => `Increases Arrow and Nature damage by ${tier}`,
      "Gain Food after each run",
    ),
  ),
  defineBuilding("alchemy-lab", "Alchemy Lab", [
    {
      cost: materialCost({ herbs: 20 }),
      effects: { potionPotency: 0.2 },
      benefitDescription: "Potions are 20% more potent",
    },
    {
      cost: materialCost({ herbs: 30 }),
      effects: { potionPotency: 0.15 },
      benefitDescription: "Potions are 35% more potent",
    },
    {
      cost: materialCost({ herbs: 40 }),
      effects: { potionPotency: 0.15 },
      benefitDescription: "Potions are 50% more potent",
    },
  ]),
  defineBuilding("runesmiths-workshop", "Runesmith's Workshop", [
    {
      cost: materialCost({ iron: 10, crystal: 10 }),
      effects: { flatBurnDamage: 1 },
      benefitDescription: "Increases Burn damage by 1",
    },
    {
      cost: materialCost({ iron: 15, crystal: 15 }),
      effects: { flatFreezeDamage: 1 },
      benefitDescription: "Increases Burn and Freeze damage by 1",
    },
    {
      cost: materialCost({ iron: 20, crystal: 20 }),
      effects: { flatNatureDamage: 1 },
      benefitDescription: "Increases Burn, Freeze, and Nature damage by 1",
    },
  ]),
  defineBuilding(
    "companion-sanctuary",
    "Companion Sanctuary",
    stackingTiers(
      dualMaterialCosts("wood", "food"),
      { companionDamage: 1 },
      (tier) => `Increases Companion damage by ${tier}`,
    ),
  ),
  defineBuilding(
    "wishing-well",
    "Wishing Well",
    stackingTiers(
      dualMaterialCosts("wood", "iron"),
      { wishCrystalGold: 1 },
      (tier) => `Gain ${tier} Crystal or Gold when you Wish`,
    ),
  ),
];

export const farmPlots = [
  defineFarm(
    "wheat-field",
    "Wheat Field",
    stackingTiers(
      singleMaterialCosts("food"),
      { cardHealBonus: { bread: 2 }, endRunFoodPerRoom: 2 },
      (tier) => `Bread restores ${2 * tier} more Health`,
      "Gain Food after each run",
    ),
    true,
  ),
  defineFarm(
    "herb-garden",
    "Herb Garden",
    stackingTiers(
      singleMaterialCosts("herbs"),
      { poisonDamageReduction: 1, natureDamageReduction: 1 },
      (tier) => `Reduces Poison and Nature damage taken by ${tier}`,
    ),
  ),
  defineFarm(
    "chicken-coop",
    "Chicken Coop",
    stackingTiers(
      dualMaterialCosts("wood", "food"),
      { runMaxHealthBonus: 5, endRunFoodPerRoom: 2 },
      (tier) => `Increases Maximum Health by ${5 * tier}`,
      "Gain Food after each run",
    ),
  ),
  defineFarm(
    "pasture",
    "Pasture",
    stackingTiers(
      dualMaterialCosts("wood", "food"),
      { freezeDamageReduction: 1, endRunFoodPerRoom: 1 },
      (tier) => `Reduces Freeze damage taken by ${tier}`,
      "Gain Food after each run",
    ),
  ),
  defineFarm(
    "orchard",
    "Orchard",
    stackingTiers(
      dualMaterialCosts("wood", "food"),
      { cardHealBonus: { apple: 2 }, endRunFoodPerRoom: 2 },
      (tier) => `Apple restores ${2 * tier} more Health`,
      "Gain Food after each run",
    ),
  ),
  defineFarm("crystal-garden", "Crystal Garden", [
    {
      cost: materialCost({ crystal: 20 }),
      effects: { endRunCrystalPerRoom: 2 },
      benefitDescription: "Gain Crystal after each run",
    },
    {
      cost: materialCost({ crystal: 30 }),
      effects: { startMana: 1, endRunCrystalPerRoom: 2 },
      benefitDescription: "Start combat with 1 additional Mana\nGain Crystal after each run",
    },
    {
      cost: materialCost({ crystal: 40 }),
      effects: { runMaxManaBonus: 1, endRunCrystalPerRoom: 2 },
      benefitDescription: "Gain 1 Mana Crystal\nGain Crystal after each run",
    },
  ]),
];

export const visibleFarmPlots = farmPlots.filter((farm) => !farm.hidden);

export const researchUpgrades = [
  defineResearch("leyline-energy", "Leyline Energy", [
    {
      cost: materialCost({ crystal: 20 }),
      effects: { startMana: 1 },
      benefitDescription: "Increases starting Mana by 1",
    },
    {
      cost: materialCost({ crystal: 30 }),
      effects: { startMana: 1, endRunCrystalPerRoom: 1 },
      benefitDescription: "Increases starting Mana by 2\nGain Crystal after each run",
      nonCombatBenefitDescription: "Gain Crystal after each run",
    },
    {
      cost: materialCost({ crystal: 40 }),
      effects: { startMana: 2, endRunCrystalPerRoom: 1 },
      benefitDescription: "Increases starting Mana by 4\nGain Crystal after each run",
      nonCombatBenefitDescription: "Gain Crystal after each run",
    },
  ]),
  defineResearch("detect-magic", "Detect Magic", [
    {
      cost: materialCost({ crystal: 20 }),
      effects: { gearAstralChanceBonus: 0.03 },
      benefitDescription: "3% increased chance to find higher rarity equipment",
    },
    {
      cost: materialCost({ crystal: 30 }),
      effects: { gearAstralChanceBonus: 0.03 },
      benefitDescription: "6% increased chance to find higher rarity equipment",
    },
    {
      cost: materialCost({ crystal: 40 }),
      effects: { gearAstralChanceBonus: 0.04 },
      benefitDescription: "10% increased chance to find higher rarity equipment",
    },
  ]),
  defineResearch(
    "botanical-distillation",
    "Botanical Distillation",
    stackingTiers(
      singleMaterialCosts("herbs"),
      { potionMixPotency: 1 },
      (tier) => `Mixing Potions increases numerical effects by ${tier}`,
    ),
  ),
  defineResearch(
    "culinary-arts",
    "Culinary Arts",
    stackingTiers(
      singleMaterialCosts("food"),
      { consumeHealMultiplier: 0.1 },
      (tier) => `Health restored from Consume increased by ${tier * 10}%`,
    ),
  ),
  defineResearch("wool-tailoring", "Wool Tailoring", [
    {
      cost: materialCost({ food: 20 }),
      effects: { freezeDamageReduction: 1 },
      benefitDescription: "Reduces Freeze damage taken by 1",
    },
    {
      cost: materialCost({ food: 30 }),
      effects: { burnDamageReduction: 1 },
      benefitDescription: "Reduces Freeze and Burn damage taken by 1",
    },
    {
      cost: materialCost({ food: 40 }),
      effects: { natureDamageReduction: 1 },
      benefitDescription: "Reduces Freeze, Burn, and Nature damage taken by 1",
    },
  ]),
  defineResearch(
    "agility-training",
    "Agility Training",
    stackingTiers(
      singleMaterialCosts("food"),
      { companionDamage: 1 },
      (tier) => `Companion damage increased by ${tier}`,
    ),
  ),
];
