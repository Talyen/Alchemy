// Talent definitions for keyword: poison.
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const poisonTalents: TalentDefinition[] = [
  {
    id: "poison-leech-chance",
    keywordId: "poison",
    name: "Hemotoxin",
    description: "Poison has a 10% chance to Leech",
    effects: [setEffect("poisonLeechChance", 10)],
  },
  {
    id: "poison-physical-bonus",
    keywordId: "poison",
    name: "Corrosive",
    description: "Enemies with Poison take +1 Physical damage",
    effects: [setEffect("poisonPhysicalBonus", 1)],
  },
  {
    id: "poison-strip-armor",
    keywordId: "poison",
    name: "Caustic",
    description: "Poison removes 1 Armor",
    effects: [setEffect("poisonStripArmor", true)],
  },
  {
    id: "poison-half-damage",
    keywordId: "poison",
    name: "Toxin Resistance",
    description: "Receive half Poison damage",
    effects: [setEffect("receiveHalfPoisonDamage", true)],
  },
  {
    id: "poison-gold-first",
    keywordId: "poison",
    name: "Toxic Profit",
    description: "The first time you Poison each combat, gain 4 Gold",
    effects: [setEffect("goldOnFirstPoison", 4)],
  },
  {
    id: "poison-heal-reduce",
    keywordId: "poison",
    name: "Necrosis",
    description: "Poison reduces enemy healing by half",
    effects: [setEffect("poisonHalvesHealing", true)],
  },
  {
    id: "poison-stun-chance",
    keywordId: "poison",
    name: "Paralytic Venom",
    description: "Poison has a 10% chance to also Stun",
    effects: [setEffect("poisonStunChance", 10)],
  },
  {
    id: "poison-gain-chance",
    keywordId: "poison",
    name: "Virulent",
    description: "Poison has a 10% chance to gain instead of lose a stack",
    effects: [setEffect("poisonGainChance", 10)],
  },
  {
    id: "poison-reduce-damage",
    keywordId: "poison",
    name: "Crippling Toxin",
    description: "Enemies with Poison deal 1 less damage",
    effects: [setEffect("poisonReducesEnemyDamage", 1)],
  },
  {
    id: "poison-first-free",
    keywordId: "poison",
    name: "Venom Strike",
    description: "Your first Poison card each combat is free",
    effects: [setEffect("firstPoisonCardFree", true)],
  },

  // --- Bleed ---
];
