// Keyword definitions (visual config per keyword) and shared card-to-keyword extraction.
// Depends on card/type shapes. Used by talent XP and reward affinity scoring.
import type { BattleCard, KeywordDefinition, KeywordId } from "./types";

export function getCardKeywords(card: BattleCard): KeywordId[] {
  const keywords = new Set<KeywordId>();

  for (const effect of card.effects) {
    switch (effect.kind) {
      case "damage":
        keywords.add(effect.damageType as KeywordId);
        if (effect.lifesteal) keywords.add("leech");
        break;
      case "player-status":
        keywords.add(effect.status as KeywordId);
        break;
      case "heal":
        keywords.add("health");
        break;
      case "restore-mana":
      case "lose-mana":
      case "lose-max-mana":
      case "gain-max-mana":
        keywords.add("mana");
        break;
      case "gain-gold":
        keywords.add("gold");
        break;
      case "wish":
        keywords.add("wish");
        break;
      case "summon-companion":
      case "buff-companion":
        keywords.add("companion");
        break;
      case "remove-harmful-status":
        break;
      case "lose-health":
        keywords.add("health");
        break;
      case "draw-cards":
        break;
      case "remove-enemy-armor":
        keywords.add("armor");
        break;
      case "multiply-enemy-status":
        keywords.add(effect.status as KeywordId);
        break;
      case "remove-player-status":
        keywords.add(effect.status as KeywordId);
        break;
    }
  }

  if (card.consume) keywords.add("consume");

  return Array.from(keywords);
}

export const keywordDefinitions: Record<KeywordId, KeywordDefinition> = {
  physical: {
    id: "physical",
    label: "Physical",
    description: "Physical damage type",
    colorClass: "text-slate-300",
    borderClass: "border-slate-300",
    shineColors: ["#cbd5e1", "#64748b", "#cbd5e1"],
  },
  stun: {
    id: "stun",
    label: "Stun",
    description: "Stun damage causes the enemy to lose a turn when it reaches more than half the remaining Health",
    colorClass: "text-amber-300",
    borderClass: "border-amber-300",
    shineColors: ["#fcd34d", "#d97706", "#fcd34d"],
  },
  block: {
    id: "block",
    label: "Block",
    description: "Block absorbs damage taken before health and decreases by half each turn",
    colorClass: "text-sky-300",
    borderClass: "border-sky-300",
    shineColors: ["#7dd3fc", "#0ea5e9", "#7dd3fc"],
  },
  forge: {
    id: "forge",
    label: "Forge",
    description:
      "Each stack of Forge increases your Physical and Stun damage dealt by 1. Dealing damage removes 1 Forge",
    colorClass: "text-orange-300",
    borderClass: "border-orange-300",
    shineColors: ["#fdba74", "#ea580c", "#fdba74"],
  },
  armor: {
    id: "armor",
    label: "Armor",
    description: "Each stack of Armor decreases Physical damage taken by 1. Taking damage removes 1 Armor",
    colorClass: "text-gray-400",
    borderClass: "border-gray-400",
    shineColors: ["#9ca3af", "#4b5563", "#9ca3af"],
  },
  health: {
    id: "health",
    label: "Health",
    description: "Health keeps you alive",
    colorClass: "text-red-400",
    borderClass: "border-red-400",
    shineColors: ["#f87171", "#b91c1c", "#f87171"],
  },
  burn: {
    id: "burn",
    label: "Burn",
    description: "Burn deals damage and reduces by half each turn",
    colorClass: "text-orange-400",
    borderClass: "border-orange-400",
    shineColors: ["#fb923c", "#ea580c", "#fb923c"],
  },
  gold: {
    id: "gold",
    label: "Gold",
    description: "Gold is exchanged for goods and services",
    colorClass: "text-yellow-300",
    borderClass: "border-yellow-300",
    shineColors: ["#fde047", "#ca8a04", "#fde047"],
  },
  holy: {
    id: "holy",
    label: "Holy",
    description: "Holy damage type",
    colorClass: "text-amber-200",
    borderClass: "border-amber-200",
    shineColors: ["#fde68a", "#d97706", "#fde68a"],
  },
  wish: {
    id: "wish",
    label: "Wish",
    description: "Choose one of three cards to add to your hand",
    colorClass: "text-fuchsia-300",
    borderClass: "border-fuchsia-300",
    shineColors: ["#f0abfc", "#c026d3", "#f0abfc"],
  },
  consume: {
    id: "consume",
    label: "Consume",
    description: "Consumed cards are removed from your deck for the remainder of the battle",
    colorClass: "text-violet-400",
    borderClass: "border-violet-400",
    shineColors: ["#a78bfa", "#6d28d9", "#a78bfa"],
    hidden: true,
  },
  poison: {
    id: "poison",
    label: "Poison",
    description: "Poison deals damage and decreases by 1 each turn",
    colorClass: "text-green-700",
    borderClass: "border-green-700",
    shineColors: ["#15803d", "#14532d", "#15803d"],
  },
  bleed: {
    id: "bleed",
    label: "Bleed",
    description: "Bleed deals damage once, and then twice as much next turn",
    colorClass: "text-red-600",
    borderClass: "border-red-600",
    shineColors: ["#dc2626", "#7f1d1d", "#dc2626"],
  },
  leech: {
    id: "leech",
    label: "Leech",
    description: "Leech heals you for the damage dealt",
    colorClass: "text-rose-800",
    borderClass: "border-rose-800",
    shineColors: ["#9f1239", "#4c0519", "#9f1239"],
  },
  freeze: {
    id: "freeze",
    label: "Freeze",
    description: "Freeze damage causes the enemy to lose their turn if it accumulates to half their remaining Health",
    colorClass: "text-cyan-300",
    borderClass: "border-cyan-300",
    shineColors: ["#67e8f9", "#06b6d4", "#67e8f9"],
  },
  mana: {
    id: "mana",
    label: "Mana",
    description: "Mana is used to play cards",
    colorClass: "text-sky-400",
    borderClass: "border-sky-400",
    shineColors: ["#38bdf8", "#0284c7", "#38bdf8"],
  },
  nature: {
    id: "nature",
    label: "Nature",
    description: "Nature damage type",
    colorClass: "text-emerald-600",
    borderClass: "border-emerald-600",
    shineColors: ["#059669", "#064e3b", "#059669"],
  },
  companion: {
    id: "companion",
    label: "Companion",
    description: "Companion cards call allied creatures to aid the Ranger",
    colorClass: "text-amber-900",
    borderClass: "border-amber-900",
    shineColors: ["#78350f", "#451a03", "#78350f"],
  },
  trap: {
    id: "trap",
    label: "Trap",
    description: "Trap cards will prepare delayed effects for unsuspecting enemies",
    colorClass: "text-lime-700",
    borderClass: "border-lime-700",
    shineColors: ["#4d7c0f", "#1a2e05", "#4d7c0f"],
  },
};
