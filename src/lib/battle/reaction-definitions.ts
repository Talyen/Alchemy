import type { DamageType, KeywordId } from "@/lib/game-data";

export const REACTION_DEFINITIONS = {
  shatter: { text: "Shatter", stat: "physical", keywords: ["freeze", "physical"] },
  frostfire: { text: "Frostfire", stat: "burn", keywords: ["freeze", "burn"] },
  rupture: { text: "Rupture", stat: "bleed", keywords: ["stun", "bleed"] },
  toxicShock: { text: "Toxic Shock", stat: "poison", keywords: ["stun", "poison"] },
  consecration: { text: "Consecration", stat: "holy", keywords: ["bleed", "holy"] },
  venomflash: { text: "Venomflash", stat: "burn", keywords: ["poison", "burn"] },
} as const satisfies Record<string, { text: string; stat: DamageType; keywords: readonly KeywordId[] }>;

export type ReactionId = keyof typeof REACTION_DEFINITIONS;
