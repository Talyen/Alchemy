// Talent definitions for keyword: archery.
import { Plug, CloudRain, Eye, ScanEye, ArrowRight } from "lucide-react";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect, placeholderTalents } from "../types";

export const archeryTalents: TalentDefinition[] = [
  {
    id: "archery-damage",
    keywordId: "archery",
    name: "Tripwire",
    description: "Increase damage dealt by Archery cards by 1",
    icon: Plug,
    effects: [addEffect("flatArrowDamage", 1)],
  },
  {
    id: "archery-hail",
    keywordId: "archery",
    name: "Hail of Arrows",
    description: "Archery cards have a 10% chance to deal 50% of their damage a second time",
    icon: CloudRain,
    effects: [setEffect("archeryPlayTwiceChance", 10)],
  },
  {
    id: "archery-eagle-eye",
    keywordId: "archery",
    name: "Eagle Eye",
    description: "Archery cards deal double damage against Stunned enemies",
    icon: Eye,
    effects: [setEffect("archeryDoubledVsStunned", true)],
  },
  {
    id: "archery-hawk-eye",
    keywordId: "archery",
    name: "Hawk Eye",
    description: "Archery cards deal double damage against Frozen enemies",
    icon: ScanEye,
    effects: [setEffect("archeryDoubledVsFrozen", true)],
  },
  {
    id: "archery-longshot",
    keywordId: "archery",
    name: "Longshot",
    description: "Archery cards deal double damage against enemies above 75% Health",
    icon: ArrowRight,
    effects: [setEffect("archeryDoubledVsHighHealth", true)],
  },
  ...placeholderTalents("archery", "archery-placeholder", 6, 10),
];
