// Talent definitions for keyword: mana.
import { MANABURN_DAMAGE_PERCENT } from "@/lib/game-constants";
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const manaTalents: TalentDefinition[] = [
  {
    id: "mana-wellspring",
    keywordId: "mana",
    name: "Wellspring",
    description: "When you end your turn with unspent Mana, keep 1 for next turn",
    icon: "Droplets",
    effects: [setEffect("wellspringKeepMana", 1)],
  },
  {
    id: "mana-bulwark",
    keywordId: "mana",
    name: "Mana Bulwark",
    description: "Start each combat with Block equal to your Mana Crystals",
    icon: "ShieldPlus",
    effects: [setEffect("manaBulwarkActive", true)],
  },
  {
    id: "mana-leylines",
    keywordId: "mana",
    name: "Leyline Attunement",
    description: "Gain 1 Mana Crystal",
    icon: "Atom",
    effects: [setEffect("startMana", 1)],
  },
  {
    id: "mana-arcane-wish",
    keywordId: "mana",
    name: "Arcane Wish",
    description: "Gain 1 Mana when you Wish",
    icon: "Sparkles",
    effects: [addEffect("manaOnWish", 1)],
  },
  {
    id: "mana-manaburn",
    keywordId: "mana",
    name: "Manaburn",
    description: `Burn damage is increased by ${MANABURN_DAMAGE_PERCENT}% of your Mana Crystals`,
    icon: "Flame",
    effects: [setEffect("burnDamagePerManaCrystal", MANABURN_DAMAGE_PERCENT)],
  },
  {
    id: "mana-arcane-frost",
    keywordId: "mana",
    name: "Arcane Frost",
    description: "Freeze damage is increased by half your Mana Crystals",
    icon: "Snowflake",
    effects: [setEffect("freezeDamagePerManaCrystal", 1)],
  },
  {
    id: "mana-flare",
    keywordId: "mana",
    name: "Mana Flare",
    description: "When you lose a Mana Crystal, deal 3 Burn damage",
    icon: "Bomb",
    effects: [setEffect("burnDamageOnManaCrystalLoss", 3)],
  },
  {
    id: "mana-familiar-bond",
    keywordId: "mana",
    name: "Familiar Bond",
    description: "Companion damage is increased by half your Mana Crystals",
    icon: "PawPrint",
    effects: [setEffect("companionDamagePerManaCrystal", 1)],
  },
  {
    id: "mana-shell",
    keywordId: "mana",
    name: "Mana Shell",
    description: "Start each combat with Armor equal to your Mana Crystals",
    icon: "ShieldHalf",
    effects: [setEffect("manaShellActive", true)],
  },
  {
    id: "mana-arcane-mending",
    keywordId: "mana",
    name: "Arcane Mending",
    description: "Restore 2 Health when you gain Mana",
    icon: "Wand",
    effects: [setEffect("healOnManaGain", 2)],
  },
];
