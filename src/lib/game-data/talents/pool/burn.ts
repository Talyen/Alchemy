// Talent definitions for keyword: burn.
import {
  Thermometer,
  WavesArrowUp,
  Shield,
  Bomb,
  TrendingUp,
  Droplets,
  TrendingDown,
  Sparkles,
  Wind,
  ShieldCheck,
} from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const burnTalents: TalentDefinition[] = [
  {
    id: "burn-dmg-1",
    keywordId: "burn",
    name: "Flashpoint",
    description: "Increase Burn damage by 1",
    icon: Thermometer,
    effects: [addEffect("flatBurnDamage", 1)],
  },
  {
    id: "burn-dmg-2",
    keywordId: "burn",
    name: "Thermal Vent",
    description: "When you deal Burn damage, gain 1 Forge",
    icon: WavesArrowUp,
    effects: [addEffect("forgeOnBurnDealt", 1)],
  },
  {
    id: "burn-dmg-5",
    keywordId: "burn",
    name: "Flaming Shield",
    description: "Burn damage is increased by 30% of your Block",
    icon: Shield,
    effects: [setEffect("blockToBurnDamage", true)],
  },
  {
    id: "burn-dmg-4",
    keywordId: "burn",
    name: "Combustible",
    description: "Cards with Consume deal 20% more Burn damage",
    icon: Bomb,
    effects: [setEffect("consumeBurnDamageBonusPercent", 20)],
  },
  {
    id: "burn-first-double",
    keywordId: "burn",
    name: "Wildfire",
    description: "Your first Burn card each combat deals 50% more damage",
    icon: TrendingUp,
    effects: [setEffect("firstBurnCardDoubled", true)],
  },
  {
    id: "burn-remove-armor",
    keywordId: "burn",
    name: "Melting Point",
    description: "Burn damage removes that amount of enemy Armor",
    icon: Droplets,
    effects: [setEffect("burnRemovesEnemyArmor", true)],
  },
  {
    id: "burn-dmg-3",
    keywordId: "burn",
    name: "Heat Exhaustion",
    description: "Burn has a 10% chance to Stun",
    icon: TrendingDown,
    effects: [setEffect("burnStunChance", 10)],
  },
  {
    id: "burn-dmg-6",
    keywordId: "burn",
    name: "Burning Wish",
    description: "When you play a Wish, deal 2 Burn damage to the enemy",
    icon: Sparkles,
    effects: [setEffect("burnOnWish", 2)],
  },
  {
    id: "burn-double-chance",
    keywordId: "burn",
    name: "Smoldering",
    description: "Burn stacks have a 5% chance to double instead of halve",
    icon: Wind,
    effects: [setEffect("burnDoubleChance", 5)],
  },
  {
    id: "burn-half-damage",
    keywordId: "burn",
    name: "Fire Resistance",
    description: "Receive half Burn damage",
    icon: ShieldCheck,
    effects: [setEffect("receiveHalfBurnDamage", true)],
  },

  // --- Gold ---
];
