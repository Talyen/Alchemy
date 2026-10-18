import type { BattleCard } from "@/lib/game-data";
import { getCardDisplayTitle } from "../cards/card-description-ui";
import { localization } from "@/lib/localization/runtime";

const inspectionTieCollator = new Intl.Collator("en");

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

function inspectionSortKey(card: BattleCard): string {
  return JSON.stringify([
    card.id,
    card.cost,
    card.effects,
    card.descriptionLines,
    card.corrupted,
    card.transmuted,
    card.uid,
  ]);
}

export function sortInspectionCards(cards: readonly BattleCard[]): BattleCard[] {
  if (cards.length <= 1) return [...cards];
  const titleCollator = titleCollatorFor(localization.language);
  return cards
    .map((card) => ({
      card,
      title: getCardDisplayTitle(card),
      key: undefined as string | undefined,
    }))
    .sort((a, b) => {
      const titleOrder = titleCollator.compare(a.title, b.title);
      if (titleOrder) return titleOrder;
      // Serialize effects and descriptions only for title ties, once per entry in this sort.
      a.key ??= inspectionSortKey(a.card);
      b.key ??= inspectionSortKey(b.card);
      return inspectionTieCollator.compare(a.key, b.key);
    })
    .map((entry) => entry.card);
}
