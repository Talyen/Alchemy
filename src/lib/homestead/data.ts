// Homestead data definitions — buildings, farm plots, and research upgrades.
// Each item has a tiers array (length 1-3) describing the cost and effects
// of each successive upgrade. Items with 3 tiers show stars in the UI.

import type { HomesteadBuilding, HomesteadFarm, HomesteadResearch } from "./types";

export const buildings: HomesteadBuilding[] = [
  {
    id: "blacksmiths-forge",
    title: "Blacksmith's Forge",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { iron: 20, wood: 0, herbs: 0, food: 0, crystal: 0 },
        effects: { flatPhysicalDamage: 1, forgeToBurn: true },
        benefitDescription: "Increases Physical damage dealt by 1\nForge effect also increases Burn damage",
      },
      {
        cost: { iron: 30, wood: 0, herbs: 0, food: 0, crystal: 0 },
        effects: { flatPhysicalDamage: 1 },
        benefitDescription: "Increases Physical damage dealt by 2",
      },
      {
        cost: { iron: 40, wood: 0, herbs: 0, food: 0, crystal: 0 },
        effects: { flatPhysicalDamage: 1 },
        benefitDescription: "Increases Physical damage dealt by 3",
      },
    ],
  },
  {
    id: "hunters-lodge",
    title: "Hunter's Lodge",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { wood: 10, food: 10, iron: 0, herbs: 0, crystal: 0 },
        effects: { flatArrowDamage: 1, flatNatureDamage: 1 },
        benefitDescription: "Increases Arrow and Nature damage by 1",
        nonCombatBenefitDescription: "Gain Food after each run",
      },
      {
        cost: { wood: 15, food: 15, iron: 0, herbs: 0, crystal: 0 },
        effects: { flatArrowDamage: 1, flatNatureDamage: 1 },
        benefitDescription: "Increases Arrow and Nature damage by 2",
        nonCombatBenefitDescription: "Gain Food after each run",
      },
      {
        cost: { wood: 20, food: 20, iron: 0, herbs: 0, crystal: 0 },
        effects: { flatArrowDamage: 1, flatNatureDamage: 1 },
        benefitDescription: "Increases Arrow and Nature damage by 3",
        nonCombatBenefitDescription: "Gain Food after each run",
      },
    ],
  },
  {
    id: "alchemy-lab",
    title: "Alchemy Lab",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { herbs: 20, wood: 0, iron: 0, food: 0, crystal: 0 },
        effects: { potionPotency: 0.2 },
        benefitDescription: "Potions are 20% more potent",
      },
      {
        cost: { herbs: 30, wood: 0, iron: 0, food: 0, crystal: 0 },
        effects: { potionPotency: 0.15 },
        benefitDescription: "Potions are 35% more potent",
      },
      {
        cost: { herbs: 40, wood: 0, iron: 0, food: 0, crystal: 0 },
        effects: { potionPotency: 0.15 },
        benefitDescription: "Potions are 50% more potent",
      },
    ],
  },
  {
    id: "runesmiths-workshop",
    title: "Runesmith's Workshop",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { iron: 10, crystal: 10, wood: 0, herbs: 0, food: 0 },
        effects: { flatBurnDamage: 1 },
        benefitDescription: "Increases Burn damage by 1",
      },
      {
        cost: { iron: 15, crystal: 15, wood: 0, herbs: 0, food: 0 },
        effects: { flatFreezeDamage: 1 },
        benefitDescription: "Increases Burn and Freeze damage by 1",
      },
      {
        cost: { iron: 20, crystal: 20, wood: 0, herbs: 0, food: 0 },
        effects: { flatNatureDamage: 1 },
        benefitDescription: "Increases Burn, Freeze, and Nature damage by 1",
      },
    ],
  },
  {
    id: "companion-sanctuary",
    title: "Companion Sanctuary",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { wood: 10, food: 10, iron: 0, herbs: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 1",
      },
      {
        cost: { wood: 15, food: 15, iron: 0, herbs: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 2",
      },
      {
        cost: { wood: 20, food: 20, iron: 0, herbs: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 3",
      },
    ],
  },
  {
    id: "wishing-well",
    title: "Wishing Well",
    description: "",
    buttonLabel: "Build",
    tiers: [
      {
        cost: { wood: 10, iron: 10, herbs: 0, food: 0, crystal: 0 },
        effects: { wishCrystalGold: 1 },
        benefitDescription: "Gain 1 Crystal or Gold when you Wish",
      },
      {
        cost: { wood: 15, iron: 15, herbs: 0, food: 0, crystal: 0 },
        effects: { wishCrystalGold: 1 },
        benefitDescription: "Gain 2 Crystal or Gold when you Wish",
      },
      {
        cost: { wood: 20, iron: 20, herbs: 0, food: 0, crystal: 0 },
        effects: { wishCrystalGold: 1 },
        benefitDescription: "Gain 3 Crystal or Gold when you Wish",
      },
    ],
  },
];

export const farmPlots: HomesteadFarm[] = [
  {
    id: "herb-garden",
    title: "Herb Garden",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      {
        cost: { herbs: 20, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { herbFindBonus: 0.1 },
        benefitDescription: "Find 10% more Herbs",
        nonCombatBenefitDescription: "Gain Herbs after each run",
      },
      {
        cost: { herbs: 30, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { herbFindBonus: 0.1 },
        benefitDescription: "Find 20% more Herbs",
        nonCombatBenefitDescription: "Gain Herbs after each run",
      },
      {
        cost: { herbs: 40, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { herbFindBonus: 0.1 },
        benefitDescription: "Find 30% more Herbs",
        nonCombatBenefitDescription: "Gain Herbs after each run",
      },
    ],
  },
  {
    id: "wheat-field",
    title: "Wheat Field",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      { cost: { food: 20, herbs: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 30, herbs: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 40, herbs: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "Produces ???" },
    ],
  },
  {
    id: "chicken-coop",
    title: "Chicken Coop",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      { cost: { food: 20, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 30, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 40, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
    ],
  },
  {
    id: "pasture",
    title: "Pasture",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      { cost: { food: 20, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 30, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { food: 40, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
    ],
  },
  {
    id: "orchard",
    title: "Orchard",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      { cost: { wood: 10, food: 10, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { wood: 15, food: 15, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
      { cost: { wood: 20, food: 20, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "Produces ???" },
    ],
  },
  {
    id: "crystal-garden",
    title: "Crystal Garden",
    description: "",
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
    tiers: [
      { cost: { crystal: 20, herbs: 0, wood: 0, iron: 0, food: 0 }, benefitDescription: "Produces ???" },
      { cost: { crystal: 30, herbs: 0, wood: 0, iron: 0, food: 0 }, benefitDescription: "Produces ???" },
      { cost: { crystal: 40, herbs: 0, wood: 0, iron: 0, food: 0 }, benefitDescription: "Produces ???" },
    ],
  },
];

export const researchUpgrades: HomesteadResearch[] = [
  {
    id: "carpentry",
    title: "Leyline Energy",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { crystal: 20, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { startMana: 1 },
        benefitDescription: "Increase starting Mana by 1",
      },
      {
        cost: { crystal: 30, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { startMana: 1 },
        benefitDescription: "Increase starting Mana by 2\nGain Crystal after each run",
        nonCombatBenefitDescription: "Gain Crystal after each run",
      },
      {
        cost: { crystal: 40, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { startMana: 2 },
        benefitDescription: "Increase starting Mana by 4\nGain Crystal after each run",
        nonCombatBenefitDescription: "Gain Crystal after each run",
      },
    ],
  },
  {
    id: "masonry",
    title: "Detect Magic",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { crystal: 20, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { trinketChanceBonus: 0.1 },
        benefitDescription: "10% increased chance to find Trinkets",
      },
      {
        cost: { crystal: 30, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { trinketChanceBonus: 0.1 },
        benefitDescription: "20% increased chance to find Trinkets",
      },
      {
        cost: { crystal: 40, wood: 0, iron: 0, herbs: 0, food: 0 },
        effects: { trinketChanceBonus: 0.1 },
        benefitDescription: "30% increased chance to find Trinkets",
      },
    ],
  },
  {
    id: "crop-rotation",
    title: "Botanical Distillation",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { herbs: 20, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { potionMixPotency: 1 },
        benefitDescription: "Mixing Potions increases numerical effects by 1",
      },
      {
        cost: { herbs: 30, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { potionMixPotency: 1 },
        benefitDescription: "Mixing Potions increases numerical effects by 2",
      },
      {
        cost: { herbs: 40, food: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { potionMixPotency: 1 },
        benefitDescription: "Mixing Potions increases numerical effects by 3",
      },
    ],
  },
  {
    id: "animal-husbandry",
    title: "Culinary Arts",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { food: 20, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { consumeHealMultiplier: 0.1 },
        benefitDescription: "Health restored from Consume increased by 10%",
      },
      {
        cost: { food: 30, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { consumeHealMultiplier: 0.1 },
        benefitDescription: "Health restored from Consume increased by 20%",
      },
      {
        cost: { food: 40, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { consumeHealMultiplier: 0.1 },
        benefitDescription: "Health restored from Consume increased by 30%",
      },
    ],
  },
  {
    id: "fortified-walls",
    title: "Wool Tailoring",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { food: 20, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { freezeDamageReduction: 1 },
        benefitDescription: "Reduce Freeze damage taken by 1",
      },
      {
        cost: { food: 30, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { burnDamageReduction: 1 },
        benefitDescription: "Reduce Freeze and Burn damage taken by 1",
      },
      {
        cost: { food: 40, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { natureDamageReduction: 1 },
        benefitDescription: "Reduce Freeze, Burn, and Nature damage taken by 1",
      },
    ],
  },
  {
    id: "metallurgy",
    title: "Agility Training",
    description: "",
    buttonLabel: "Research",
    tiers: [
      {
        cost: { food: 20, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Companion damage increased by 1",
      },
      {
        cost: { food: 30, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Companion damage increased by 2",
      },
      {
        cost: { food: 40, herbs: 0, wood: 0, iron: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Companion damage increased by 3",
      },
    ],
  },
];
