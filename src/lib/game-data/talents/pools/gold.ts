import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("gold");

export const goldTalents = [
  t("gold-shop-discount", "Haggle", "Shop purchases cost 5 less Gold", "Tag", setEffect("shopCardDiscount", 5)),
  t(
    "gold-shop-refresh",
    "Restock",
    "Shop refreshes have a 10% chance to be free, once per shop",
    "RefreshCw",
    setEffect("shopFreeRefreshChance", 10),
  ),
  t(
    "gold-start",
    "Seed Money",
    "Dealing Nature damage has a 10% chance to also grant Gold",
    "Sprout",
    setEffect("goldOnNatureDamageChance", 10),
  ),
  t(
    "gold-per-combat",
    "Lucky Foot",
    "When you Dodge, you have a 25% chance to gain 4 Gold",
    "CircleDollarSign",
    setEffect("goldOnDodge", 4),
  ),
  t(
    "gold-potion-discount",
    "Apothecary Membership",
    "Potion purchases cost 5 less Gold",
    "Beaker",
    setEffect("potionDiscount", 5),
  ),
  t(
    "gold-remove-discount",
    "Buyout",
    "Card removal costs 10 less Gold",
    "ShoppingCart",
    setEffect("removeCardDiscount", 10),
  ),
  t("gold-enemy-drop", "Plunder", "Enemies drop 10% more Gold", "HandCoins", setEffect("enemyGoldDropBonus", 0.1)),
  t(
    "gold-on-wish",
    "Golden Wish",
    "10% chance to gain 7 Gold when you Wish",
    "Sparkles",
    setEffect("goldOnWish", 7),
    setEffect("goldOnWishChance", 10),
  ),
  t(
    "gold-mix-discount",
    "Alchemy Discount",
    "Mixing Potions costs 10 less Gold",
    "FlaskConical",
    setEffect("mixPotionDiscount", 10),
  ),
  t(
    "gold-elite-drop",
    "Coinmail",
    "Gaining Armor has a 10% chance to also grant Gold",
    "Trophy",
    setEffect("goldOnArmorGainChance", 10),
  ),
];
