// Homestead data definitions — buildings, farm plots, and research upgrades.
// Plain TS objects following the same pattern as cards.ts and compendium.ts.

import type { HomesteadBuilding, HomesteadFarm, HomesteadResearch } from "./types";

export const buildings: HomesteadBuilding[] = [
  {
    id: "blacksmiths-forge",
    title: "Blacksmith's Forge",
    description: "",
    cost: { iron: 20, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "Increases Physical damage dealt by 1\nForge effect also increases Burn damage",
    buttonLabel: "Build",
  },
  {
    id: "hunters-lodge",
    title: "Hunter's Lodge",
    description: "",
    cost: { wood: 20, food: 10, iron: 0, herbs: 0, crystal: 0 },
    benefitDescription: "Increases Companion damage by 1",
    nonCombatBenefitDescription: "Gain Food after each run",
    buttonLabel: "Build",
  },
  {
    id: "alchemy-lab",
    title: "Alchemy Lab",
    description: "",
    cost: { herbs: 20, wood: 10, iron: 0, food: 0, crystal: 0 },
    benefitDescription: "Potions restore 20% more Health",
    nonCombatBenefitDescription: "Potions cost 10% less Gold",
    buttonLabel: "Build",
  },
  {
    id: "placeholder-1",
    title: "Placeholder",
    description: "",
    cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "???",
    buttonLabel: "Build",
  },
  {
    id: "placeholder-2",
    title: "Placeholder",
    description: "",
    cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "???",
    buttonLabel: "Build",
  },
  {
    id: "placeholder-3",
    title: "Placeholder",
    description: "",
    cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "???",
    buttonLabel: "Build",
  },

];

export const farmPlots: HomesteadFarm[] = [
  {
    id: "herb-garden",
    title: "Herb Garden",
    description: "",
    cost: { herbs: 5, food: 0, wood: 0, iron: 0, crystal: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    benefitDescription: "Potions restore +1 Mana",
    nonCombatBenefitDescription: "Gain Herbs after each run",
    buttonLabel: "Build",
  },
  {
    id: "wheat-field",
    title: "Wheat Field",
    description: "",
    cost: { food: 5, herbs: 0, wood: 0, iron: 0, crystal: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "chicken-coop",
    title: "Chicken Coop",
    description: "",
    cost: { food: 12, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "pasture",
    title: "Pasture",
    description: "",
    cost: { food: 13, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "orchard",
    title: "Orchard",
    description: "",
    cost: { wood: 8, food: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "crystal-garden",
    title: "Crystal Garden",
    description: "",
    cost: { crystal: 8, herbs: 0, wood: 0, iron: 0, food: 0 },
    yield: { herbs: 0, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
];

export const researchUpgrades: HomesteadResearch[] = [
  {
    id: "carpentry",
    title: "Advanced Carpentry",
    description: "",
    cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "Building costs -10%",
    buttonLabel: "Research",
  },
  {
    id: "masonry",
    title: "Stone Masonry",
    description: "",
    cost: { iron: 25, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "Building costs -10%",
    buttonLabel: "Research",
  },
  {
    id: "crop-rotation",
    title: "Crop Rotation",
    description: "",
    cost: { herbs: 15, food: 0, wood: 0, iron: 0, crystal: 0 },
    benefitDescription: "Farm yields +50%",
    buttonLabel: "Research",
  },
  {
    id: "animal-husbandry",
    title: "Animal Husbandry",
    description: "",
    cost: { food: 25, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    benefitDescription: "Farm yields +25%",
    buttonLabel: "Research",
  },
  {
    id: "fortified-walls",
    title: "Fortified Walls",
    description: "",
    cost: { iron: 30, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+5 Starting Block",
    buttonLabel: "Research",
  },
  {
    id: "metallurgy",
    title: "Metallurgy",
    description: "",
    cost: { iron: 15, crystal: 0, wood: 0, herbs: 0, food: 0 },
    benefitDescription: "+2% Physical Crit Chance",
    buttonLabel: "Research",
  },
];
