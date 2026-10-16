import type { DamageType, KeywordId } from "@/lib/game-data";

export const REACTION_DEFINITIONS = {
  shatter: { text: "Shatter", stat: "physical", keywords: ["freeze", "physical"] },
  frostfire: { text: "Frostfire", stat: "burn", keywords: ["freeze", "burn"] },
  thunderclap: { text: "Thunderclap", stat: "nature", keywords: ["stun", "nature"] },
  wildfire: { text: "Wildfire", stat: "burn", keywords: ["burn", "nature"] },
  consecration: { text: "Consecration", stat: "holy", keywords: ["bleed", "holy"] },
  bloodboil: { text: "Bloodboil", stat: "burn", keywords: ["burn", "bleed"] },
  venomflash: { text: "Venomflash", stat: "burn", keywords: ["poison", "burn"] },
} as const satisfies Record<string, { text: string; stat: DamageType; keywords: readonly KeywordId[] }>;

export type ReactionId = keyof typeof REACTION_DEFINITIONS;
