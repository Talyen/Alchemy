// Talent definitions for keyword: stun.
import { Flame, TrendingUp, Shield, Clock, ShieldOff, Bolt, Gift, Waves, Eye, PlugZap } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const stunTalents: TalentDefinition[] = [
  {
    id: "stun-forge-grant",
    keywordId: "stun",
    name: "Riled Up",
    description: "When you Stun an enemy, gain 2 Forge",
    icon: Flame,
    effects: [setEffect("forgeOnStun", 2)],
  },
  {
    id: "stun-double-damage",
    keywordId: "stun",
    name: "Exploit Weakness",
    description: "Stunned enemies take double damage",
    icon: TrendingUp,
    effects: [setEffect("stunDoubleDamage", true)],
  },
  {
    id: "stun-block-grant",
    keywordId: "stun",
    name: "Guarded Counter",
    description: "When you Stun an enemy, gain 3 Block",
    icon: Shield,
    effects: [setEffect("blockOnStun", 3)],
  },
  {
    id: "stun-duration-1",
    keywordId: "stun",
    name: "Extended Stun",
    description: "Stun effects last 1 turn longer",
    icon: Clock,
    effects: [setEffect("stunDurationExtension", 1)],
  },
  {
    id: "stun-strip-armor",
    keywordId: "stun",
    name: "Shatter Guard",
    description: "Stunned enemies lose all Armor",
    icon: ShieldOff,
    effects: [setEffect("stunStripArmor", true)],
  },
  {
    id: "stun-damage-1",
    keywordId: "stun",
    name: "Jarring Blow",
    description: "Increase Stun damage by 1",
    icon: Bolt,
    effects: [addEffect("flatStunDamage", 1)],
  },
  {
    id: "stun-next-free",
    keywordId: "stun",
    name: "Free Follow-up",
    description: "When you Stun an enemy, your next card is free",
    icon: Gift,
    effects: [setEffect("nextCardFreeOnStun", true)],
  },
  {
    id: "stun-threshold",
    keywordId: "stun",
    name: "Concussive Force",
    description: "Stun threshold reduced by 10%",
    icon: Waves,
    effects: [setEffect("stunThresholdReduction", 0.1)],
  },
  {
    id: "stun-draw",
    keywordId: "stun",
    name: "Stun Insight",
    description: "When you Stun an enemy, draw a card",
    icon: Eye,
    effects: [setEffect("drawOnStun", 1)],
  },
  {
    id: "stun-mana-grant",
    keywordId: "stun",
    name: "Stun Surge",
    description: "When you Stun an enemy, gain 1 Mana",
    icon: PlugZap,
    effects: [setEffect("manaOnStun", 1)],
  },

  // --- Block ---
];
