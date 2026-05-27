// Talent definitions for keyword: archery.
import type { TalentDefinition } from "../types";
import { addEffect, placeholderTalents } from "../types";

export const archeryTalents: TalentDefinition[] = [
  {
    id: "archery-damage",
    keywordId: "archery",
    name: "Tripwire",
    description: "Increase damage dealt by Archery cards by 1",
    effects: [addEffect("flatArrowDamage", 1)],
  },
  ...placeholderTalents("archery", "archery-placeholder", 2, 10),
];
