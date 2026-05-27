// Talent definitions for keyword: holy.
import type { TalentDefinition } from "../types";
import { setEffect } from "../types";

export const holyTalents: TalentDefinition[] = [
  {
    id: "holy-tithe",
    keywordId: "holy",
    name: "Tithe",
    description: "10% chance to gain Gold equal to Holy damage",
    effects: [setEffect("holyGoldChance", 10)],
  },
  {
    id: "holy-block-scaling",
    keywordId: "holy",
    name: "Faith Barrier",
    description: "Holy damage is increased by half your Block",
    effects: [setEffect("blockToHolyDamage", true)],
  },
  {
    id: "holy-wish-chance",
    keywordId: "holy",
    name: "Divine Intervention",
    description: "Holy damage has a 5% chance to Wish",
    effects: [setEffect("holyWishChance", 5)],
  },
  {
    id: "holy-burn-chance",
    keywordId: "holy",
    name: "Scorching Light",
    description: "Holy damage has a 10% chance to Burn",
    effects: [setEffect("holyBurnChance", 10)],
  },
  {
    id: "holy-half-damage",
    keywordId: "holy",
    name: "Celestial Ward",
    description: "Receive half Holy damage",
    effects: [setEffect("receiveHalfHolyDamage", true)],
  },
  {
    id: "holy-first-free",
    keywordId: "holy",
    name: "Divine Favor",
    description: "Your first Holy card each combat is free",
    effects: [setEffect("firstHolyCardFree", true)],
  },
  {
    id: "holy-gold-scaling",
    keywordId: "holy",
    name: "Prosperity",
    description: "Holy damage is increased by 3% of your Gold",
    effects: [setEffect("holyGoldPercent", 3)],
  },
  {
    id: "holy-block-grant",
    keywordId: "holy",
    name: "Radiant Guard",
    description: "Holy damage grants Block for 15% of the amount dealt",
    effects: [setEffect("holyBlockPercentFromDamage", 15)],
  },
  {
    id: "holy-vs-burn",
    keywordId: "holy",
    name: "Purge",
    description: "Holy damage is increased by 20% against enemies with Burn",
    effects: [setEffect("holyVsBurnMultiplier", 20)],
  },
  {
    id: "holy-lifesteal",
    keywordId: "holy",
    name: "Blessed Leech",
    description: "Holy damage heals you for 10% of the amount dealt",
    effects: [setEffect("holyLifestealPercent", 10)],
  },

  // --- Wish ---
];
