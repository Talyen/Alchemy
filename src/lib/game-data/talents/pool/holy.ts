// Talent definitions for keyword: holy.
import {
  Cross,
  Shield,
  Sparkles,
  Flame,
  ShieldCheck,
  Gift,
  TrendingUp,
  ShieldPlus,
  Eraser,
  HeartPulse,
} from "lucide-react";
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const holyTalents: TalentDefinition[] = [
  {
    id: "holy-tithe",
    keywordId: "holy",
    name: "Tithe",
    description: "10% chance to gain Gold equal to Holy damage",
    icon: Cross,
    effects: [setEffect("holyGoldChance", 10)],
  },
  {
    id: "holy-block-scaling",
    keywordId: "holy",
    name: "Faith Barrier",
    description: "Holy damage is increased by half your Block",
    icon: Shield,
    effects: [setEffect("blockToHolyDamage", true)],
  },
  {
    id: "holy-wish-chance",
    keywordId: "holy",
    name: "Divine Intervention",
    description: "Holy damage has a 5% chance to Wish",
    icon: Sparkles,
    effects: [setEffect("holyWishChance", 5)],
  },
  {
    id: "holy-burn-chance",
    keywordId: "holy",
    name: "Scorching Light",
    description: "Holy damage has a 10% chance to Burn",
    icon: Flame,
    effects: [setEffect("holyBurnChance", 10)],
  },
  {
    id: "holy-half-damage",
    keywordId: "holy",
    name: "Celestial Ward",
    description: "Receive half Holy damage",
    icon: ShieldCheck,
    effects: [setEffect("receiveHalfHolyDamage", true)],
  },
  {
    id: "holy-first-free",
    keywordId: "holy",
    name: "Divine Favor",
    description: "Your first Holy card each combat is free",
    icon: Gift,
    effects: [setEffect("firstHolyCardFree", true)],
  },
  {
    id: "holy-gold-scaling",
    keywordId: "holy",
    name: "Prosperity",
    description: "Holy damage is increased by 3% of your Gold",
    icon: TrendingUp,
    effects: [setEffect("holyGoldPercent", 3)],
  },
  {
    id: "holy-block-grant",
    keywordId: "holy",
    name: "Radiant Guard",
    description: "Holy damage grants Block for 15% of the amount dealt",
    icon: ShieldPlus,
    effects: [setEffect("holyBlockPercentFromDamage", 15)],
  },
  {
    id: "holy-vs-burn",
    keywordId: "holy",
    name: "Purge",
    description: "Holy damage is increased by 20% against Burning enemies",
    icon: Eraser,
    effects: [setEffect("holyVsBurnMultiplier", 20)],
  },
  {
    id: "holy-lifesteal",
    keywordId: "holy",
    name: "Blessed Leech",
    description: "Holy damage heals you for 10% of the amount dealt",
    icon: HeartPulse,
    effects: [setEffect("holyLifestealPercent", 10)],
  },

  // --- Wish ---
];
