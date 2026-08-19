// Talent definitions for keyword: poison.
import { Biohazard, Droplets, FlaskRound, Shield, Coins, Skull, Lock, TrendingUp, X, Syringe } from "lucide-react";
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const poisonTalents: TalentDefinition[] = [
  {
    id: "poison-leech-chance",
    keywordId: "poison",
    name: "Hemotoxin",
    description: "Poison has a 10% chance to Leech",
    icon: Biohazard,
    effects: [setEffect("poisonLeechChance", 10)],
  },
  {
    id: "poison-physical-bonus",
    keywordId: "poison",
    name: "Corrosive",
    description: "Poisoned enemies take +1 Physical damage",
    icon: Droplets,
    effects: [setEffect("poisonPhysicalBonus", 1)],
  },
  {
    id: "poison-strip-armor",
    keywordId: "poison",
    name: "Caustic",
    description: "Poison removes 1 Armor",
    icon: FlaskRound,
    effects: [setEffect("poisonStripArmor", true)],
  },
  {
    id: "poison-half-damage",
    keywordId: "poison",
    name: "Toxin Resistance",
    description: "Receive half Poison damage",
    icon: Shield,
    effects: [setEffect("receiveHalfPoisonDamage", true)],
  },
  {
    id: "poison-gold-first",
    keywordId: "poison",
    name: "Toxic Profit",
    description: "The first time you Poison each combat, gain 4 Gold",
    icon: Coins,
    effects: [setEffect("goldOnFirstPoison", 4)],
  },
  {
    id: "poison-heal-reduce",
    keywordId: "poison",
    name: "Necrosis",
    description: "Poison reduces enemy healing by half",
    icon: Skull,
    effects: [setEffect("poisonHalvesHealing", true)],
  },
  {
    id: "poison-stun-chance",
    keywordId: "poison",
    name: "Paralytic Venom",
    description: "Poison damage and ticks have a 10% chance to deal Stun damage",
    icon: Lock,
    effects: [setEffect("poisonStunChance", 10)],
  },
  {
    id: "poison-gain-chance",
    keywordId: "poison",
    name: "Virulent",
    description: "Poison has a 10% chance to gain instead of lose a stack",
    icon: TrendingUp,
    effects: [setEffect("poisonGainChance", 10)],
  },
  {
    id: "poison-reduce-damage",
    keywordId: "poison",
    name: "Crippling Toxin",
    description: "Poisoned enemies deal 1 less damage",
    icon: X,
    effects: [setEffect("poisonReducesEnemyDamage", 1)],
  },
  {
    id: "poison-first-free",
    keywordId: "poison",
    name: "Venom Strike",
    description: "Your first Poison card each combat is free",
    icon: Syringe,
    effects: [setEffect("firstPoisonCardFree", true)],
  },
];
