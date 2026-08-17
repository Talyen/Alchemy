// Talent definitions for keyword: nature.
import { TrendingUp, Wind, Triangle, RotateCw, Network, Shield, Link, Hexagon, Trees, Leaf } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const natureTalents: TalentDefinition[] = [
  {
    id: "nature-overgrowth",
    keywordId: "nature",
    name: "Overgrowth",
    description: "Increase Nature damage dealt by 1",
    icon: TrendingUp,
    effects: [addEffect("flatNatureDamage", 1)],
  },
  {
    id: "nature-toxic-pollen",
    keywordId: "nature",
    name: "Toxic Pollen",
    description: "Nature damage has a 10% chance to Poison",
    icon: Wind,
    effects: [setEffect("naturePoisonChance", 10)],
  },
  {
    id: "nature-briar-patch",
    keywordId: "nature",
    name: "Briar Patch",
    description: "Nature damage has a 10% chance to Bleed",
    icon: Triangle,
    effects: [setEffect("natureBleedChance", 10)],
  },
  {
    id: "nature-verdant-cycle",
    keywordId: "nature",
    name: "Verdant Cycle",
    description: "Nature damage has a 10% chance to Leech",
    icon: RotateCw,
    effects: [setEffect("natureLeechChance", 10)],
  },
  {
    id: "nature-ecosystem",
    keywordId: "nature",
    name: "Ecosystem",
    description: "Deal +1 Nature damage against Poisoned enemies",
    icon: Network,
    effects: [setEffect("natureBonusVsPoisoned", 1)],
  },
  {
    id: "nature-natural-armor",
    keywordId: "nature",
    name: "Natural Armor",
    description: "Nature damage taken is reduced by half",
    icon: Shield,
    effects: [setEffect("receiveHalfNatureDamage", true)],
  },
  {
    id: "nature-entangle",
    keywordId: "nature",
    name: "Entangle",
    description: "Nature damage has a 10% chance to Stun",
    icon: Link,
    effects: [setEffect("natureStunChance", 10)],
  },
  {
    id: "nature-thornskin",
    keywordId: "nature",
    name: "Thornskin",
    description: "Nature damage is increased by your Armor",
    icon: Hexagon,
    effects: [setEffect("armorToNatureDamage", true)],
  },
  {
    id: "nature-canopy",
    keywordId: "nature",
    name: "Canopy",
    description: "Gain 3 Block when you play a Nature card",
    icon: Trees,
    effects: [setEffect("blockOnNatureCard", 3)],
  },
  {
    id: "nature-photosynthesis",
    keywordId: "nature",
    name: "Photosynthesis",
    description: "Restore 1 Health when you play a Nature card",
    icon: Leaf,
    effects: [setEffect("healOnNatureCard", 1)],
  },
];
