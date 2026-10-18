import type { BattleCard } from "@/lib/game-data";
import { getCardDisplayTitle } from "../cards/card-description-ui";
import { localization } from "@/lib/localization/runtime";

const titleCollators = new Map<string, Intl.Collator>();

function titleCollatorFor(language: string): Intl.Collator {
  const locale = language === "en-XA" ? "en" : language;
  let collator = titleCollators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale);
    titleCollators.set(locale, collator);
  }
  return collator;
}

function compareInspectionTiebreak(a: BattleCard, b: BattleCard): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  if (a.cost !== b.cost) return a.cost - b.cost;
  const aCorrupted = a.corrupted ? 1 : 0;
  const bCorrupted = b.corrupted ? 1 : 0;
  if (aCorrupted !== bCorrupted) return aCorrupted - bCorrupted;
  const aTransmuted = a.transmuted ?? "";
  const bTransmuted = b.transmuted ?? "";
  if (aTransmuted !== bTransmuted) return aTransmuted < bTransmuted ? -1 : 1;
  const aUid = a.uid ?? -1;
  const bUid = b.uid ?? -1;
  if (aUid !== bUid) return aUid - bUid;
  if (a.effects.length !== b.effects.length) return a.effects.length - b.effects.length;
  if (a.descriptionLines.length !== b.descriptionLines.length)
    return a.descriptionLines.length - b.descriptionLines.length;
  return 0;
}

export function sortInspectionCards(cards: readonly BattleCard[]): BattleCard[] {
  if (cards.length <= 1) return [...cards];
  const titleCollator = titleCollatorFor(localization.language);
  return cards
    .map((card) => ({
      card,
      title: getCardDisplayTitle(card),
    }))
    .sort((a, b) => {
      const titleOrder = titleCollator.compare(a.title, b.title);
      if (titleOrder) return titleOrder;
      return compareInspectionTiebreak(a.card, b.card);
    })
    .map((entry) => entry.card);
}
