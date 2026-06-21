// Talent definitions for keyword: health.
import {
  HeartCrack,
  Shield,
  Activity,
  ChevronsUp,
  TrendingUp,
  HeartPulse,
  Container,
  Sparkles,
  ShieldHalf,
  Flame,
} from "lucide-react";
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const healthTalents: TalentDefinition[] = [
  {
    id: "health-threshold-armor",
    keywordId: "health",
    name: "Last Resort",
    description: "When Health drops below 25%, gain 3 Armor",
    icon: HeartCrack,
    effects: [setEffect("healthThresholdArmor", { threshold: 25, amount: 3 })],
  },
  {
    id: "health-threshold-block",
    keywordId: "health",
    name: "Desperate Guard",
    description: "When Health drops below 50%, gain 6 Block",
    icon: Shield,
    effects: [setEffect("healthThresholdBlock", { threshold: 50, amount: 6 })],
  },
  {
    id: "health-max-4",
    keywordId: "health",
    name: "Will to Live",
    description: "Death's Door lasts 1 turn longer",
    icon: Activity,
    effects: [setEffect("deathsDoorExtension", 1)],
  },
  {
    id: "health-start",
    keywordId: "health",
    name: "Combat Surge",
    description: "Restore 4 Health at the start of combat",
    icon: ChevronsUp,
    effects: [setEffect("startHealth", 4)],
  },
  {
    id: "health-max-per-combat",
    keywordId: "health",
    name: "Vitality",
    description: "Gain 1 Max Health after every combat",
    icon: TrendingUp,
    effects: [setEffect("maxHealthPerCombat", 1)],
  },
  {
    id: "health-heal-boost",
    keywordId: "health",
    name: "Mending",
    description: "Healing effects are 10% stronger",
    icon: HeartPulse,
    effects: [setEffect("healMultiplier", 1.1)],
  },
  {
    id: "health-max-1",
    keywordId: "health",
    name: "Overflow",
    description: "When you overheal, gain 50% of the excess as Block",
    icon: Container,
    effects: [setEffect("overhealToBlockRatio", 0.5)],
  },
  {
    id: "health-max-2",
    keywordId: "health",
    name: "Cleansing Status",
    description: "Cleansing a status restores 6 Health",
    icon: Sparkles,
    effects: [setEffect("healOnStatusCleanse", 6)],
  },
  {
    id: "health-max-3",
    keywordId: "health",
    name: "Thick Skin",
    description: "Reduce all damage taken by 1",
    icon: ShieldHalf,
    effects: [setEffect("damageReduction", 1)],
  },
  {
    id: "health-campfire",
    keywordId: "health",
    name: "Warm Rest",
    description: "Campfire heals 10% more Health",
    icon: Flame,
    effects: [setEffect("campfireHealBonus", 0.1)],
  },

  // --- Burn ---
];
