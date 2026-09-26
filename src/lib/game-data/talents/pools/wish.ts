import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("wish");

export const wishTalents = [
  t(
    "wish-trinket",
    "Wishful Trinket",
    "50% chance to gain 1 Forge or Armor when you Wish",
    "Gem",
    setEffect("wishTrinketChoice", true),
  ),
  t(
    "wish-undiscovered",
    "Discovery",
    "Wish always includes an undiscovered card when one is available",
    "Compass",
    setEffect("wishUndiscoveredCards", true),
  ),
  t("wish-health", "Vital Wish", "Restore 1 Health when you Wish", "Heart", setEffect("healthOnWish", 1)),
  t(
    "wish-cleanse",
    "Purifying Wish",
    "Cleanse 1 harmful status effect when you Wish",
    "Sparkle",
    setEffect("removeHarmfulStatusOnWish", true),
  ),
  t(
    "wish-extra-choice",
    "Generous Wish",
    "Wish cards have a 10% chance to play twice",
    "Gift",
    setEffect("wishCardPlayTwiceChance", 10),
  ),
  t("wish-draw", "Insight", "Wish has a 10% chance to draw a card", "Eye", setEffect("wishDrawChance", 10)),
  t("wish-powerful", "Powerful Wish", "Wish cards are upgraded", "Bolt", setEffect("wishCardsUpgraded", true)),
  t("wish-mana", "Mana from Heaven", "Gain 1 Mana when you Wish", "CloudRain", addEffect("manaOnWish", 1)),
  t(
    "wish-gold",
    "Roads Not Taken",
    "Wish has a 10% chance to also grant one of the cards not chosen",
    "Coins",
    setEffect("declinedWishCardChance", 10),
  ),
  t(
    "wish-desperate",
    "Desperate Wish",
    "When you Wish below half Health, gain 2 Block",
    "HeartCrack",
    setEffect("wishBlockBelowHealthPct", 50),
    setEffect("wishBlockAmount", 2),
  ),
];
