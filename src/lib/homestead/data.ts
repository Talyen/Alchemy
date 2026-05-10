// Homestead data definitions — buildings, farm plots, and research upgrades.
// Plain TS objects following the same pattern as cards.ts and compendium.ts.

import type { HomesteadBuilding, HomesteadFarm, HomesteadResearch } from "./types";

export const buildings: HomesteadBuilding[] = [
  {
    id: "blacksmiths-forge",
    title: "Blacksmith's Forge",
    description: "A forge and anvil for crafting deadlier weapons.",
    cost: { iron: 20, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+2% Physical Crit Chance",
    buttonLabel: "Build",
  },
  {
    id: "workshop",
    title: "Workshop",
    description: "A sturdy workbench for honing weapons.",
    cost: { wood: 15, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+1 Physical Damage",
    buttonLabel: "Build",
  },
  {
    id: "storehouse",
    title: "Storehouse",
    description: "A secure vault for your adventuring funds.",
    cost: { wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+5 Starting Gold",
    buttonLabel: "Build",
  },
  {
    id: "stone-walls",
    title: "Stone Walls",
    description: "Fortifications that provide shelter on the road.",
    cost: { iron: 15, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+3 Starting Block",
    buttonLabel: "Build",
  },
  {
    id: "herb-shed",
    title: "Herb Shed",
    description: "A dry place to stockpile medicinal herbs.",
    cost: { herbs: 10, wood: 0, iron: 0, food: 0, crystal: 0 },
    benefitDescription: "+5% Campfire Healing",
    buttonLabel: "Build",
  },
  {
    id: "watchtower",
    title: "Watchtower",
    description: "A tall tower that keeps you vigilant and hearty.",
    cost: { wood: 25, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+5 Max Health",
    buttonLabel: "Build",
  },
];

export const farmPlots: HomesteadFarm[] = [
  {
    id: "herb-garden",
    title: "Herb Garden",
    description: "A neat patch of medicinal and aromatic herbs.",
    cost: { herbs: 5, food: 0, wood: 0, iron: 0, crystal: 0 },
    yield: { herbs: 2, wood: 0, iron: 0, food: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "wheat-field",
    title: "Wheat Field",
    description: "A sun-drenched field of golden wheat.",
    cost: { food: 5, herbs: 0, wood: 0, iron: 0, crystal: 0 },
    yield: { food: 2, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "chicken-coop",
    title: "Chicken Coop",
    description: "A cozy home for a flock of laying hens.",
    cost: { food: 12, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { food: 3, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "pasture",
    title: "Pasture",
    description: "A grassy pasture with a gentle flock.",
    cost: { food: 13, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { food: 3, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "orchard",
    title: "Orchard",
    description: "A small grove of fruit-bearing trees.",
    cost: { wood: 8, food: 0, iron: 0, herbs: 0, crystal: 0 },
    yield: { food: 2, wood: 1, iron: 0, herbs: 0, crystal: 0 },
    buttonLabel: "Build",
  },
  {
    id: "crystal-garden",
    title: "Crystal Garden",
    description: "A geomantically attuned patch that grows shimmering crystals.",
    cost: { crystal: 8, herbs: 0, wood: 0, iron: 0, food: 0 },
    yield: { crystal: 2, herbs: 1, wood: 0, iron: 0, food: 0 },
    buttonLabel: "Build",
  },
];

export const researchUpgrades: HomesteadResearch[] = [
  {
    id: "carpentry",
    title: "Advanced Carpentry",
    description: "Better woodworking techniques reduce construction costs.",
    cost: { wood: 20, iron: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "Building costs -10%",
    buttonLabel: "Research",
  },
  {
    id: "masonry",
    title: "Stone Masonry",
    description: "Superior stonecutting lowers building material needs.",
    cost: { iron: 25, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "Building costs -10%",
    buttonLabel: "Research",
  },
  {
    id: "crop-rotation",
    title: "Crop Rotation",
    description: "Rotating fields keeps soil fertile and yields high.",
    cost: { herbs: 15, food: 0, wood: 0, iron: 0, crystal: 0 },
    benefitDescription: "Farm yields +50%",
    buttonLabel: "Research",
  },
  {
    id: "animal-husbandry",
    title: "Animal Husbandry",
    description: "Better animal care means more produce from your livestock.",
    cost: { food: 25, wood: 0, iron: 0, herbs: 0, crystal: 0 },
    benefitDescription: "Farm yields +25%",
    buttonLabel: "Research",
  },
  {
    id: "fortified-walls",
    title: "Fortified Walls",
    description: "Reinforced stonework bolsters your defences.",
    cost: { iron: 30, wood: 0, herbs: 0, food: 0, crystal: 0 },
    benefitDescription: "+5 Starting Block",
    buttonLabel: "Research",
  },
  {
    id: "metallurgy",
    title: "Metallurgy",
    description: "Refined smelting techniques let you forge sharper blades.",
    cost: { iron: 15, crystal: 0, wood: 0, herbs: 0, food: 0 },
    benefitDescription: "+2% Physical Crit Chance",
    buttonLabel: "Research",
  },
];
