// Talent definitions for keyword: nature.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect, placeholderTalents } from "../types";

export const natureTalents: TalentDefinition[] = [
  {
    id: "nature-overgrowth",
    keywordId: "nature",
    name: "Overgrowth",
    description: "Increase Nature damage dealt by 1",
    effects: [addEffect("flatNatureDamage", 1)],
  },
  {
    id: "nature-toxic-pollen",
    keywordId: "nature",
    name: "Toxic Pollen",
    description: "Nature damage has a 10% chance to Poison",
    effects: [setEffect("naturePoisonChance", 10)],
  },
  {
    id: "nature-briar-patch",
    keywordId: "nature",
    name: "Briar Patch",
    description: "Nature damage has a 10% chance to Bleed",
    effects: [setEffect("natureBleedChance", 10)],
  },
  {
    id: "nature-verdant-cycle",
    keywordId: "nature",
    name: "Verdant Cycle",
    description: "Nature damage has a 10% chance to Leech",
    effects: [setEffect("natureLeechChance", 10)],
  },
  {
    id: "nature-ecosystem",
    keywordId: "nature",
    name: "Ecosystem",
    description: "Deal +1 Nature damage against Poisoned enemies",
    effects: [setEffect("natureBonusVsPoisoned", 1)],
  },
  {
    id: "nature-natural-armor",
    keywordId: "nature",
    name: "Natural Armor",
    description: "Nature damage taken is reduced by half",
    effects: [setEffect("receiveHalfNatureDamage", true)],
  },
  ...placeholderTalents("nature", "nature-placeholder", 7, 10),
];
