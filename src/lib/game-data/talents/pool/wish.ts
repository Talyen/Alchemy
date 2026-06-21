// Talent definitions for keyword: wish.
import { Gem, Compass, Heart, Sparkle, Gift, Eye, Bolt, CloudRain, Coins, HeartCrack } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const wishTalents: TalentDefinition[] = [
  {
    id: "wish-trinket",
    keywordId: "wish",
    name: "Wishful Trinket",
    description: "Gain 1 Forge or Armor when you Wish",
    icon: Gem,
    effects: [setEffect("wishTrinketChoice", true)],
  },
  {
    id: "wish-undiscovered",
    keywordId: "wish",
    name: "Discovery",
    description: "Wish can offer cards not yet in your collection",
    icon: Compass,
    effects: [setEffect("wishUndiscoveredCards", true)],
  },
  {
    id: "wish-health",
    keywordId: "wish",
    name: "Vital Wish",
    description: "Gain 2 Health when you Wish",
    icon: Heart,
    effects: [setEffect("healthOnWish", 2)],
  },
  {
    id: "wish-cleanse",
    keywordId: "wish",
    name: "Purifying Wish",
    description: "Cleanse a harmful status effect when you Wish",
    icon: Sparkle,
    effects: [setEffect("removeHarmfulStatusOnWish", true)],
  },
  {
    id: "wish-extra-choice",
    keywordId: "wish",
    name: "Generous Wish",
    description: "Wish has a 20% chance to offer an extra card choice",
    icon: Gift,
    effects: [setEffect("wishExtraChoiceChance", 20)],
  },
  {
    id: "wish-draw",
    keywordId: "wish",
    name: "Insight",
    description: "Wish also draws a card",
    icon: Eye,
    effects: [setEffect("wishDrawsCard", true)],
  },
  {
    id: "wish-powerful",
    keywordId: "wish",
    name: "Powerful Wish",
    description: "Wish card numeric values are increased by 1",
    icon: Bolt,
    effects: [setEffect("wishCardsUpgraded", true)],
  },
  {
    id: "wish-mana",
    keywordId: "wish",
    name: "Mana from Heaven",
    description: "Gain 1 Mana when you Wish",
    icon: CloudRain,
    effects: [addEffect("manaOnWish", 1)],
  },
  {
    id: "wish-gold",
    keywordId: "wish",
    name: "Golden Opportunity",
    description: "Gain 2 Gold when you Wish",
    icon: Coins,
    effects: [setEffect("goldOnWishAmount", 2)],
  },
  {
    id: "wish-desperate",
    keywordId: "wish",
    name: "Desperate Wish",
    description: "Gain 6 Block when you Wish below 30% Health",
    icon: HeartCrack,
    effects: [setEffect("wishBlockBelowHealthPct", 30)],
  },
  // --- Poison ---
];
