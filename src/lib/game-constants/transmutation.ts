import type { KeywordId } from "@/lib/game-data";

export const TRANSMUTATION_KEYWORD_GROUPS = [
  ["physical", "holy", "nature", "burn", "poison", "bleed", "freeze", "stun"],
  ["block", "armor", "forge", "thorns", "health", "leech"],
  ["mana", "gold", "wish", "archery", "consume", "dodge", "companion"],
] as const satisfies ReadonlyArray<readonly KeywordId[]>;

export const TRANSMUTATION_PREFIXES: Record<KeywordId, string> = {
  physical: "Brutal",
  holy: "Hallowed",
  nature: "Verdant",
  burn: "Burning",
  poison: "Venomous",
  bleed: "Bloodletting",
  freeze: "Freezing",
  stun: "Concussive",
  block: "Guarded",
  armor: "Armored",
  forge: "Forged",
  thorns: "Thorned",
  health: "Restorative",
  mana: "Arcane",
  gold: "Gilded",
  wish: "Wishing",
  leech: "Leeching",
  archery: "Aimed",
  consume: "Fleeting",
  dodge: "Elusive",
  companion: "Bonded",
};
