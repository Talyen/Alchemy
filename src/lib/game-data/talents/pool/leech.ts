// Talent definitions for keyword: leech.
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const leechTalents: TalentDefinition[] = [
  {
    id: "leech-first-double",
    keywordId: "leech",
    name: "First Blood",
    description: "Your first Leech card each combat heals for double",
    effects: [setEffect("firstLeechCardDoubled", true)],
  },
  {
    id: "leech-desperate",
    keywordId: "leech",
    name: "Desperate Siphon",
    description: "Leech is 20% more effective while below 50% Health",
    effects: [setEffect("leechDesperateMultiplier", 20)],
  },
  {
    id: "leech-blood-debt",
    keywordId: "leech",
    name: "Blood Debt",
    description: "Leech heals for 1 more per 8 missing Health",
    effects: [setEffect("leechMissingHealthStep", 8)],
  },
  {
    id: "leech-bleed-chance",
    keywordId: "leech",
    name: "Hemorrhage",
    description: "Leech has a 10% chance to Bleed",
    effects: [setEffect("leechBleedChance", 10)],
  },
  {
    id: "leech-cull-weak",
    keywordId: "leech",
    name: "Cull the Weak",
    description: "Leech is 20% more effective against enemies below 50% Health",
    effects: [setEffect("leechExecuteMultiplier", 20)],
  },
  {
    id: "leech-mana-siphon",
    keywordId: "leech",
    name: "Mana Siphon",
    description: "Leech has a 10% chance to gain 1 Mana",
    effects: [setEffect("manaOnLeechChance", 10)],
  },
  {
    id: "leech-boon-siphon",
    keywordId: "leech",
    name: "Boon Siphon",
    description: "Leech has a 20% chance to steal 1 Forge, Armor, or Block",
    effects: [setEffect("boonSiphonChance", 20)],
  },
  {
    id: "leech-poison",
    keywordId: "leech",
    name: "Virulent Leech",
    description: "Leech has a 10% chance to Poison",
    effects: [setEffect("leechPoisonChance", 10)],
  },
  {
    id: "leech-block-enemy",
    keywordId: "leech",
    name: "Blood Type",
    description: "Enemies cannot restore Health when they Leech",
    effects: [setEffect("blockEnemyLeech", true)],
  },
  {
    id: "leech-nature-chance",
    keywordId: "leech",
    name: "Carnivorous Nature",
    description: "Nature damage has a 10% chance to Leech",
    effects: [setEffect("natureLeechChance", 10)],
  },
];
