import type { KeywordDefinition, KeywordId } from "./types";

export const keywordDefinitions: Record<KeywordId, KeywordDefinition> = {
  physical: { id: "physical", label: "Physical", description: "Physical damage type", colorClass: "text-slate-300" },
  stun: { id: "stun", label: "Stun", description: "Stun damage causes the enemy to lose a turn when it reaches more than half the remaining HP", colorClass: "text-amber-300" },
  block: { id: "block", label: "Block", description: "Block absorbs damage taken before health and decreases by half each turn", colorClass: "text-sky-300" },
  forge: { id: "forge", label: "Forge", description: "Each stack of Forge increases your Physical and Stun damage dealt by 1", colorClass: "text-yellow-300" },
  armor: { id: "armor", label: "Armor", description: "Each stack of Armor decreases damage taken by 1.", colorClass: "text-yellow-200" },
  health: { id: "health", label: "Health", description: "If Health reaches 0, your run ends", colorClass: "text-rose-400" },
  burn: { id: "burn", label: "Burn", description: "Burn deals damage and reduces by half each turn", colorClass: "text-orange-400" },
  gold: { id: "gold", label: "Gold", description: "Gold is earned during battle and spent between fights", colorClass: "text-yellow-300" },
  holy: { id: "holy", label: "Holy", description: "Holy damage type", colorClass: "text-amber-200" },
  wish: { id: "wish", label: "Wish", description: "Choose one of three cards to add to your hand", colorClass: "text-fuchsia-300" },
  ailment: { id: "ailment", label: "Ailment", description: "Ailments are harmful status effects", colorClass: "text-violet-300" },
  consume: { id: "consume", label: "Consume", description: "Consumed cards are removed from your deck for the remainder of the battle", colorClass: "text-zinc-300" },
  poison: { id: "poison", label: "Poison", description: "Poison deals damage each turn", colorClass: "text-lime-300" },
  bleed: { id: "bleed", label: "Bleed", description: "Bleed deals damage once, and then twice as much next turn", colorClass: "text-red-400" },
  leech: { id: "leech", label: "Leech", description: "Lifesteal heals you for the amount of damage dealt", colorClass: "text-pink-300" },
  freeze: { id: "freeze", label: "Freeze", description: "Freeze damage causes the enemy to lose their turn if it accumulates to half their remaining HP", colorClass: "text-cyan-300" },
  mana: { id: "mana", label: "Mana", description: "Mana is used to play cards", colorClass: "text-sky-400" },
};
