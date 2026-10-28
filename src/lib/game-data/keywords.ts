import type { BattleCard, BattleCardEffect, CompanionDefinition, KeywordDefinition, KeywordId } from "./types";
import { collectKeywordsFromBattleEffects } from "./effect-metadata";
import { TALENT_TREE_KEYWORD_IDS } from "./talents/xp-keywords";
import { isDeeplyFrozenData } from "@/lib/immutable-data";

// Cache only fully frozen effect trees; copied cards remain editable. Consume
// and tags belong to the card that actually requested the keywords.
const EFFECT_KEYWORD_CACHE = new WeakMap<readonly BattleCardEffect[], readonly KeywordId[]>();
const CARD_KEYWORD_CACHE = new WeakMap<BattleCard, readonly KeywordId[]>();

function cachedEffectKeywords(effects: readonly BattleCardEffect[]): readonly KeywordId[] {
  const cached = EFFECT_KEYWORD_CACHE.get(effects);
  if (cached) return cached;
  const result = Object.freeze(collectKeywordsFromBattleEffects(effects));
  if (isDeeplyFrozenData(effects)) EFFECT_KEYWORD_CACHE.set(effects, result);
  return result;
}

function mergeCardKeywords(card: BattleCard, base: readonly KeywordId[]): KeywordId[] {
  if (!card.consume && !card.tags?.length) return [...base];
  if (card.consume && !card.tags?.length) return base.includes("consume") ? [...base] : [...base, "consume"];
  if (card.tags?.length === 1) {
    const tag = card.tags[0]!;
    const keywords = [...base];
    if (card.consume && !base.includes("consume")) keywords.push("consume");
    if (!keywords.includes(tag)) keywords.push(tag);
    return keywords;
  }
  const keywords = new Set(base);
  if (card.consume) keywords.add("consume");
  for (const tag of card.tags ?? []) keywords.add(tag);
  return [...keywords];
}

export function getCardKeywords(card: BattleCard): KeywordId[] {
  const cached = CARD_KEYWORD_CACHE.get(card);
  return cached ? [...cached] : mergeCardKeywords(card, cachedEffectKeywords(card.effects));
}

/** Internal read-only view for consumers that do not retain or mutate keywords. */
export function getCardKeywordView(card: BattleCard): readonly KeywordId[] {
  const cached = CARD_KEYWORD_CACHE.get(card);
  if (cached) return cached;
  const base = cachedEffectKeywords(card.effects);
  if (
    (!card.consume || base.includes("consume")) &&
    (!card.tags?.length || card.tags.every((tag) => base.includes(tag)))
  )
    return base;
  const merged = mergeCardKeywords(card, base);
  if (isDeeplyFrozenData(card)) {
    Object.freeze(merged);
    CARD_KEYWORD_CACHE.set(card, merged);
  }
  return merged;
}

/** Predicate callers can use the immutable cache without copying its array. */
export function cardHasKeyword(card: BattleCard, keyword: string): boolean {
  return (
    (keyword === "consume" && !!card.consume) ||
    (card.tags?.includes(keyword as KeywordId) ?? false) ||
    cachedEffectKeywords(card.effects).includes(keyword as KeywordId)
  );
}

/** Read-only view for consumers that do not retain or mutate keywords. */
export function getCompanionKeywordView(companion: CompanionDefinition): readonly KeywordId[] {
  return cachedEffectKeywords(companion.turnStartEffects);
}

export function getCompanionKeywords(companion: CompanionDefinition): KeywordId[] {
  return [...getCompanionKeywordView(companion)];
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
  health: {
    id: "health",
    label: "Health",
    description: "Health keeps you alive",
    colorClass: "text-red-400",
    borderClass: "border-red-400",
    shineColors: ["#f87171", "#b91c1c", "#f87171"],
  },
  mana: {
    id: "mana",
    label: "Mana",
    description: "Mana is used to play cards",
    colorClass: "text-sky-400",
    borderClass: "border-sky-400",
    shineColors: ["#38bdf8", "#0284c7", "#38bdf8"],
  },
  block: {
    id: "block",
    label: "Block",
    description: "Block absorbs damage before Health. Halves each turn.",
    colorClass: "text-sky-300",
    borderClass: "border-sky-300",
    shineColors: ["#7dd3fc", "#0ea5e9", "#7dd3fc"],
  },
  dodge: {
    id: "dodge",
    label: "Dodge",
    description:
      "Both sides have a base 5% chance to avoid each attack damage packet before Block and Armor, preventing its damage and status effects; hero Dodge is capped at 75%; damage over time, status-only effects, and triggered damage cannot be Dodged",
    colorClass: "text-lime-300",
    borderClass: "border-lime-300",
    shineColors: ["#bef264", "#65a30d", "#bef264"],
  },
  armor: {
    id: "armor",
    label: "Armor",
    description: "Armor reduces incoming Physical and Stun damage by 1 per stack. Lose 1 Armor when damaged.",
    colorClass: "text-gray-400",
    borderClass: "border-gray-400",
    shineColors: ["#9ca3af", "#4b5563", "#9ca3af"],
  },
  forge: {
    id: "forge",
    label: "Forge",
    description: "Forge adds 1 Physical and Stun damage per stack.",
    colorClass: "text-orange-300",
    borderClass: "border-orange-300",
    shineColors: ["#fdba74", "#ea580c", "#fdba74"],
  },
  burn: {
    id: "burn",
    label: "Burn",
    description: "Burn deals damage each turn, then halves.",
    colorClass: "text-orange-400",
    borderClass: "border-orange-400",
    shineColors: ["#fb923c", "#ea580c", "#fb923c"],
  },
  freeze: {
    id: "freeze",
    label: "Freeze",
    description:
      "Freeze builds toward Frozen, which skips a turn. Normally triggers at half the hero's maximum Health or the enemy's Health before the hit.",
    colorClass: "text-cyan-300",
    borderClass: "border-cyan-300",
    shineColors: ["#67e8f9", "#06b6d4", "#67e8f9"],
  },
  holy: {
    id: "holy",
    label: "Holy",
    description: "Holy damage type",
    colorClass: "text-amber-200",
    borderClass: "border-amber-200",
    shineColors: ["#fde68a", "#d97706", "#fde68a"],
  },
  poison: {
    id: "poison",
    label: "Poison",
    description: "Poison deals damage each turn, then loses 20% of its stacks (at least 1).",
    colorClass: "text-green-700",
    borderClass: "border-green-700",
    shineColors: ["#15803d", "#14532d", "#15803d"],
  },
  bleed: {
    id: "bleed",
    label: "Bleed",
    description: "Bleed repeats its damage next turn, then clears.",
    colorClass: "text-red-600",
    borderClass: "border-red-600",
    shineColors: ["#dc2626", "#7f1d1d", "#dc2626"],
  },
  stun: {
    id: "stun",
    label: "Stun",
    description:
      "Stun builds toward Stunned, which skips a turn. Normally triggers at half the hero's maximum Health or the enemy's Health before the hit.",
    colorClass: "text-amber-300",
    borderClass: "border-amber-300",
    shineColors: ["#fcd34d", "#d97706", "#fcd34d"],
  },
  nature: {
    id: "nature",
    label: "Nature",
    description: "Nature damage type",
    colorClass: "text-emerald-600",
    borderClass: "border-emerald-600",
    shineColors: ["#059669", "#064e3b", "#059669"],
  },
  archery: {
    id: "archery",
    label: "Archery",
    description: "Archery cards use ranged attacks with varied damage types",
    colorClass: "text-lime-700",
    borderClass: "border-lime-700",
    shineColors: ["#4d7c0f", "#1a2e05", "#4d7c0f"],
  },
  companion: {
    id: "companion",
    label: "Companion",
    description: "Summon an allied creature; summon cards leave the battle after playing",
    colorClass: "text-amber-900",
    borderClass: "border-amber-900",
    shineColors: ["#78350f", "#451a03", "#78350f"],
  },
  leech: {
    id: "leech",
    label: "Leech",
    description: "Leech restores half the damage dealt as Health",
    colorClass: "text-rose-800",
    borderClass: "border-rose-800",
    shineColors: ["#9f1239", "#4c0519", "#9f1239"],
  },
  wish: {
    id: "wish",
    label: "Wish",
    description:
      "Choose a card from a Wish offer, normally three choices; chosen cards are queued when your hand is full",
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
  },
  gold: {
    id: "gold",
    label: "Gold",
    description: "Gold is exchanged for goods and services",
    colorClass: "text-yellow-300",
    borderClass: "border-yellow-300",
    pillBgClass: "bg-yellow-300/15",
    shineColors: ["#fde047", "#ca8a04", "#fde047"],
  },
  thorns: {
    id: "thorns",
    label: "Thorns",
    description: "Thorns are consumed when hit, dealing Nature damage to the attacker.",
    colorClass: "text-emerald-600",
    borderClass: "border-emerald-600",
    shineColors: ["#059669", "#064e3b", "#059669"],
  },
};

/** Keywords that earn in-run Talent XP; tree-less keywords stay out of the XP and Health math. */
export function filterKeywordsForTalentXP(keywords: readonly KeywordId[]): KeywordId[] {
  return keywords.filter((keyword) => TALENT_TREE_KEYWORD_IDS.has(keyword));
}
