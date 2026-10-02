import {
  cardLibrary,
  companionLibrary,
  trinketLibrary,
  visitBattleCardEffects,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { validateCardDescriptionParity, validateTrinketDescriptionParity } from "./card-parity";
import { CardContentSchema, TrinketContentSchema } from "./schemas";
import { validateLibraryBasics, type Collector } from "./utils";

function validateCardOffers(card: BattleCard, offerableIds: Set<string>, collector: Collector): void {
  if (card.excludeFromOfferPool && offerableIds.has(card.id))
    collector.error("rewards", card.id, "Card is excluded from offer pool but was found in offerable card pool");
  if (!card.excludeFromOfferPool && !offerableIds.has(card.id))
    collector.error("rewards", card.id, "Library card is missing from offerable card pool");
}

export function validateCards(collector: Collector): void {
  validateLibraryBasics(collector, {
    area: "cards",
    items: cardLibrary,
    schema: CardContentSchema,
    titleOf: (card) => card.title,
    artOf: (card) => card.art,
    idLabel: "card id",
  });

  const companionIds = new Set(Object.keys(companionLibrary));
  const offerableIds = new Set(getOfferableCardPool().map((card) => card.id));
  for (const card of cardLibrary) {
    for (const issue of validateCardDescriptionParity(card)) collector.issues.push(issue);
    const chanceIssues: string[] = [];
    visitBattleCardEffects(card.effects, (effect) => {
      if (effect.kind === "summon-companion" && !companionIds.has(effect.companionId)) {
        collector.error("cards", card.id, `References unknown companion: ${effect.companionId}`);
      }
      // Empty failure branches are allowed for synthesized runtime bonuses,
      // but never for authored cards. Keep these after reference diagnostics.
      if (effect.kind === "chance" && effect.failureEffects.length === 0) {
        chanceIssues.push("Authored chance effect has an empty failure branch");
      }
    });
    for (const message of chanceIssues) collector.error("cards", card.id, message);
    validateCardOffers(card, offerableIds, collector);
    if (card.cost >= 5) collector.warning("balance", card.id, `Card cost ${card.cost} is unusually high`);
    if (card.effects.length === 0 && !card.excludeFromOfferPool)
      collector.warning("balance", card.id, "Card has no authored effects");
  }
}

export function validateTrinkets(collector: Collector, entries: readonly TrinketEntry[] = trinketLibrary): void {
  validateLibraryBasics(collector, {
    area: "trinkets",
    items: entries,
    schema: TrinketContentSchema,
    titleOf: (trinket) => trinket.title,
    artOf: (trinket) => trinket.art,
    idLabel: "trinket id",
  });
  for (const trinket of entries) {
    for (const issue of validateTrinketDescriptionParity(trinket)) {
      collector.issues.push(issue);
    }
  }
}
