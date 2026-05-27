// Talent definitions for keyword: arrow.
import type { TalentDefinition } from "../types";
import { addEffect, placeholderTalents } from "../types";

export const arrowTalents: TalentDefinition[] = [
  {
    id: "arrow-damage",
    keywordId: "arrow",
    name: "Tripwire",
    description: "Increase Arrow damage by 1",
    effects: [addEffect("flatArrowDamage", 1)],
  },
  ...placeholderTalents("arrow", "arrow-placeholder", 2, 10),
];
