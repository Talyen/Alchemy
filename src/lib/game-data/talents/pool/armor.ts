// Talent definitions for keyword: armor.
import { HeartCrack, Shield, Flame, ShieldPlus, Square, Hexagon, Lock, Anchor, Sparkles, Plus } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const armorTalents: TalentDefinition[] = [
  {
    id: "armor-desperate-double",
    keywordId: "armor",
    name: "Last Stand",
    description: "Armor gained is doubled when Health is below 50%",
    icon: HeartCrack,
    effects: [setEffect("armorDoubledBelowHalfHealth", true)],
  },
  {
    id: "armor-block-burst",
    keywordId: "armor",
    name: "Armored Surge",
    description: "When you reach 4 Armor, gain 8 Block",
    icon: Shield,
    effects: [setEffect("armorBlockThreshold", 4), setEffect("armorBlockAmount", 8)],
  },
  {
    id: "armor-burn-mitigate",
    keywordId: "armor",
    name: "Fireward",
    description: "Armor now mitigates Burn damage taken",
    icon: Flame,
    effects: [setEffect("armorMitigatesBurn", true)],
  },
  {
    id: "armor-break-block",
    keywordId: "armor",
    name: "Reactive Guard",
    description: "When Armor breaks, gain 5 Block",
    icon: ShieldPlus,
    effects: [setEffect("armorBreakBlock", 5)],
  },
  {
    id: "armor-start-combat",
    keywordId: "armor",
    name: "Bulwark",
    description: "Start each combat with 2 Armor",
    icon: Square,
    effects: [setEffect("startArmor", 2)],
  },
  {
    id: "armor-mitigate-bleed",
    keywordId: "armor",
    name: "Thick Hide",
    description: "Armor now mitigates Bleed damage taken",
    icon: Hexagon,
    effects: [setEffect("armorMitigatesBleed", true)],
  },
  {
    id: "armor-first-double",
    keywordId: "armor",
    name: "Iron Guard",
    description: "Your first Armor card each combat is doubled",
    icon: Lock,
    effects: [setEffect("firstArmorCardDoubled", true)],
  },
  {
    id: "armor-mitigate-stun",
    keywordId: "armor",
    name: "Steadfast",
    description: "When Health falls below 50%, gain 5 Armor",
    icon: Anchor,
    effects: [setEffect("healthThresholdArmor", { threshold: 50, amount: 5 })],
  },
  {
    id: "armor-cleanse-threshold",
    keywordId: "armor",
    name: "Purification",
    description: "When you reach 6 Armor, cleanse all harmful status effects",
    icon: Sparkles,
    effects: [setEffect("armorCleanseThreshold", 6)],
  },
  {
    id: "armor-flat-bonus",
    keywordId: "armor",
    name: "Reinforced",
    description: "Increase Armor gained by 1",
    icon: Plus,
    effects: [addEffect("flatArmorAmount", 1)],
  },

  // --- Health ---
];
