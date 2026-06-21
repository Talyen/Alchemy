// Talent definitions for keyword: gold.
import {
  Tag,
  RefreshCw,
  Sprout,
  CircleDollarSign,
  Beaker,
  ShoppingCart,
  HandCoins,
  Sparkles,
  FlaskConical,
  Trophy,
} from "lucide-react";
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const goldTalents: TalentDefinition[] = [
  {
    id: "gold-shop-discount",
    keywordId: "gold",
    name: "Haggle",
    description: "Shop purchases cost 5 less Gold",
    icon: Tag,
    effects: [setEffect("shopCardDiscount", 5)],
  },
  {
    id: "gold-shop-refresh",
    keywordId: "gold",
    name: "Restock",
    description: "Shop refresh is free once per visit",
    icon: RefreshCw,
    effects: [setEffect("shopFreeRefresh", true)],
  },
  {
    id: "gold-start",
    keywordId: "gold",
    name: "Seed Money",
    description: "Start each run with 20 Gold",
    icon: Sprout,
    effects: [setEffect("startGold", 20)],
  },
  {
    id: "gold-per-combat",
    keywordId: "gold",
    name: "Bounty",
    description: "Gain +5 Gold after each combat",
    icon: CircleDollarSign,
    effects: [setEffect("goldPerCombat", 5)],
  },
  {
    id: "gold-potion-discount",
    keywordId: "gold",
    name: "Apothecary Bargain",
    description: "Potions cost 5 less Gold",
    icon: Beaker,
    effects: [setEffect("potionDiscount", 5)],
  },
  {
    id: "gold-remove-discount",
    keywordId: "gold",
    name: "Buyout",
    description: "Card removal costs 10 less Gold",
    icon: ShoppingCart,
    effects: [setEffect("removeCardDiscount", 10)],
  },
  {
    id: "gold-enemy-drop",
    keywordId: "gold",
    name: "Plunder",
    description: "Enemies drop 10% more Gold",
    icon: HandCoins,
    effects: [setEffect("enemyGoldDropBonus", 0.1)],
  },
  {
    id: "gold-on-wish",
    keywordId: "gold",
    name: "Golden Wish",
    description: "Gain 3 Gold when you Wish",
    icon: Sparkles,
    effects: [setEffect("goldOnWish", 3)],
  },
  {
    id: "gold-mix-discount",
    keywordId: "gold",
    name: "Alchemy Discount",
    description: "Mix Potions costs 10 less Gold",
    icon: FlaskConical,
    effects: [setEffect("mixPotionDiscount", 10)],
  },
  {
    id: "gold-elite-drop",
    keywordId: "gold",
    name: "Spoils of War",
    description: "Elites drop 10% more Gold",
    icon: Trophy,
    effects: [setEffect("eliteGoldDropBonus", 0.1)],
  },

  // --- Holy ---
];
