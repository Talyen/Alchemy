import type { BattleCard, KeywordId } from "@/lib/game-data";

export type TalentXP = Partial<Record<KeywordId, number>>;

export function xpForNextPoint(currentPoints: number): number {
  return (currentPoints + 1) * 10;
}

export function xpThresholdForPoints(points: number): number {
  return points * (points + 1) * 5;
}

export function computeTalentPoints(xp: number): number {
  if (xp < 10) return 0;
  return Math.floor((-1 + Math.sqrt(1 + 0.8 * xp)) / 2);
}

export function xpToNextPoint(xp: number): number {
  const currentPoints = computeTalentPoints(xp);
  const nextThreshold = xpThresholdForPoints(currentPoints + 1);
  return Math.max(0, nextThreshold - xp);
}

export function extractCardKeywords(card: BattleCard): KeywordId[] {
  const keywords = new Set<KeywordId>();
  if (card.consume) keywords.add("consume");
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
      case "wish":
        keywords.add("wish");
        break;
      case "gain-gold":
        keywords.add("gold");
        break;
      case "restore-mana":
      case "lose-mana":
      case "gain-max-mana":
      case "lose-max-mana":
        keywords.add("mana");
        break;
      case "remove-ailment":
        keywords.add("ailment");
        break;
    }
  }
  return Array.from(keywords);
}

export function addTalentXP(xp: TalentXP, keywordIds: KeywordId[], amount = 1): TalentXP {
  const next = { ...xp };
  for (const kw of keywordIds) {
    next[kw] = (next[kw] ?? 0) + amount;
  }
  return next;
}
