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
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 1",
        nonCombatBenefitDescription: "Gain Food after each run",
      },
      {
        cost: { wood: 15, food: 15, iron: 0, herbs: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 2",
        nonCombatBenefitDescription: "Gain Food after each run",
      },
      {
        cost: { wood: 20, food: 20, iron: 0, herbs: 0, crystal: 0 },
        effects: { companionDamage: 1 },
        benefitDescription: "Increases Companion damage by 3",
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
    id: "placeholder-1",
    title: "Placeholder",
    description: "",
    buttonLabel: "Build",
    tiers: [
      { cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 30, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
    ],
  },
  {
    id: "placeholder-2",
    title: "Placeholder",
    description: "",
    buttonLabel: "Build",
    tiers: [
      { cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 30, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
    ],
  },
  {
    id: "placeholder-3",
    title: "Placeholder",
    description: "",
    buttonLabel: "Build",
    tiers: [
      { cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
      { cost: { wood: 30, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "???" },
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
    title: "Advanced Carpentry",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { wood: 30, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { wood: 40, iron: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
    ],
  },
  {
    id: "masonry",
    title: "Stone Masonry",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { iron: 25, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 35, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 45, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
    ],
  },
  {
    id: "crop-rotation",
    title: "Crop Rotation",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { herbs: 15, food: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { herbs: 25, food: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { herbs: 35, food: 0, wood: 0, iron: 0, crystal: 0 }, benefitDescription: "TBD" },
    ],
  },
  {
    id: "animal-husbandry",
    title: "Animal Husbandry",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { food: 25, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { food: 35, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { food: 45, wood: 0, iron: 0, herbs: 0, crystal: 0 }, benefitDescription: "TBD" },
    ],
  },
  {
    id: "fortified-walls",
    title: "Fortified Walls",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { iron: 30, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 45, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 60, wood: 0, herbs: 0, food: 0, crystal: 0 }, benefitDescription: "TBD" },
    ],
  },
  {
    id: "metallurgy",
    title: "Metallurgy",
    description: "",
    buttonLabel: "Research",
    tiers: [
      { cost: { iron: 15, crystal: 0, wood: 0, herbs: 0, food: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 25, crystal: 0, wood: 0, herbs: 0, food: 0 }, benefitDescription: "TBD" },
      { cost: { iron: 35, crystal: 0, wood: 0, herbs: 0, food: 0 }, benefitDescription: "TBD" },
    ],
  },
];
