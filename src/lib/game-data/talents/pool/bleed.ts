// Talent definitions for keyword: bleed.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const bleedTalents: TalentDefinition[] = [
  {
    id: "bleed-first-free",
    keywordId: "bleed",
    name: "First Blood",
    description: "Your first Bleed card each combat is free",
    effects: [setEffect("firstBleedCardFree", true)],
  },
  {
    id: "bleed-physical-bonus",
    keywordId: "bleed",
    name: "Open Wound",
    description: "Enemies with Bleed take +1 Physical damage",
    effects: [setEffect("bleedPhysicalBonus", 1)],
  },
  {
    id: "bleed-leech-chance",
    keywordId: "bleed",
    name: "Sanguine",
    description: "Bleed has a 15% chance to Leech",
    effects: [setEffect("bleedLeechChance", 15)],
  },
  {
    id: "bleed-enemy-weak",
    keywordId: "bleed",
    name: "Mortal Wound",
    description: "Bleed reduces enemy healing by half",
    effects: [setEffect("bleedHalvesEnemyHealing", true)],
  },
  {
    id: "bleed-wound-care",
    keywordId: "bleed",
    name: "Wound Care",
    description: "Receive half Bleed damage",
    effects: [setEffect("receiveHalfBleedDamage", true)],
  },
  {
    id: "bleed-execute",
    keywordId: "bleed",
    name: "Exsanguinate",
    description: "Bleed deals double damage against enemies below 30% Health",
    effects: [setEffect("bleedExecuteThreshold", 30)],
  },
  {
    id: "bleed-desperate",
    keywordId: "bleed",
    name: "Bleeding Out",
    description: "You deal double Bleed damage while below 50% Health",
    effects: [setEffect("bleedDesperateMultiplier", 2)],
  },
  {
    id: "bleed-poison-chance",
    keywordId: "bleed",
    name: "Tainted Wound",
    description: "Bleed has a 10% chance to Poison",
    effects: [setEffect("bleedPoisonChance", 10)],
  },
  {
    id: "bleed-septic-shock",
    keywordId: "bleed",
    name: "Septic Shock",
    description: "Bleed increases Poison damage taken by 1",
    effects: [setEffect("bleedPoisonDamageTakenBonus", 1)],
  },
  {
    id: "bleed-rip-and-tear",
    keywordId: "bleed",
    name: "Rip and Tear",
    description: "Companion Bleed damage is increased by 1",
    effects: [addEffect("companionBleedDamageBonus", 1)],
  },

  // --- Leech ---
];
