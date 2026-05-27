// Talent definitions for keyword: wish.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const wishTalents: TalentDefinition[] = [
  {
    id: "wish-boon",
    keywordId: "wish",
    name: "Wishful Boon",
    description: "Gain 1 Forge or Armor when you Wish",
    effects: [setEffect("wishBoonChoice", true)],
  },
  {
    id: "wish-undiscovered",
    keywordId: "wish",
    name: "Discovery",
    description: "Wish can offer cards not yet in your collection",
    effects: [setEffect("wishUndiscoveredCards", true)],
  },
  {
    id: "wish-health",
    keywordId: "wish",
    name: "Vital Wish",
    description: "Gain 2 Health when you Wish",
    effects: [setEffect("healthOnWish", 2)],
  },
  {
    id: "wish-cleanse",
    keywordId: "wish",
    name: "Purifying Wish",
    description: "Cleanse a harmful status effect when you Wish",
    effects: [setEffect("removeHarmfulStatusOnWish", true)],
  },
  {
    id: "wish-extra-choice",
    keywordId: "wish",
    name: "Generous Wish",
    description: "Wish has a 20% chance to offer an extra card choice",
    effects: [setEffect("wishExtraChoiceChance", 20)],
  },
  {
    id: "wish-draw",
    keywordId: "wish",
    name: "Insight",
    description: "Wish also draws a card",
    effects: [setEffect("wishDrawsCard", true)],
  },
  {
    id: "wish-powerful",
    keywordId: "wish",
    name: "Powerful Wish",
    description: "Wish card numeric values are increased by 1",
    effects: [setEffect("wishCardsUpgraded", true)],
  },
  {
    id: "wish-mana",
    keywordId: "wish",
    name: "Mana from Heaven",
    description: "Gain 1 Mana when you Wish",
    effects: [addEffect("manaOnWish", 1)],
  },
  {
    id: "wish-gold",
    keywordId: "wish",
    name: "Golden Opportunity",
    description: "Gain 2 Gold when you Wish",
    effects: [setEffect("goldOnWishAmount", 2)],
  },
  {
    id: "wish-desperate",
    keywordId: "wish",
    name: "Desperate Wish",
    description: "Gain 6 Block when you Wish below 30% Health",
    effects: [setEffect("wishBlockBelowHealthPct", 30)],
  },
  // --- Poison ---
];
