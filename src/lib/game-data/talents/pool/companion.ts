// Talent definitions for keyword: companion.
import type { TalentDefinition } from "../types";
import { addEffect, placeholderTalents, setEffect } from "../types";

export const companionTalents: TalentDefinition[] = [
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
];
