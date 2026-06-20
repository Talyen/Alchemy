// Talent definitions for keyword: companion.
import type { TalentDefinition } from "../types";
import { addEffect, placeholderTalents, setEffect } from "../types";

export const companionTalents: TalentDefinition[] = [
  {
    id: "companion-damage",
    keywordId: "companion",
    name: "Feral Strength",
    description: "Increase Companion damage by 1",
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-gold-find",
    keywordId: "companion",
    name: "Scavenger",
    description: "Companions sometimes find Gold after combat",
    effects: [setEffect("companionGoldFindActive", true)],
  },
  {
    id: "companion-leech",
    keywordId: "companion",
    name: "Leech Companion",
    description: "Companions have a 10% chance to Leech",
    effects: [setEffect("companionLeechChance", 10)],
  },
  {
    id: "companion-hunters-bond",
    keywordId: "companion",
    name: "Hunter's Bond",
    description: "When you play a Companion card, draw a card",
    effects: [setEffect("drawOnCompanionCard", 1)],
  },
  {
    id: "companion-predator-instinct",
    keywordId: "companion",
    name: "Predator's Instinct",
    description: "Companions deal double damage against enemies below 30% Health",
    effects: [setEffect("companionDoubledVsLowHealth", true)],
  },
  {
    id: "companion-tame",
    keywordId: "companion",
    name: "Tame",
    description: "Companions deal 1 additional damage of their native type each turn",
    effects: [addEffect("companionDamage", 1)],
  },
  {
    id: "companion-loyal",
    keywordId: "companion",
    name: "Loyal",
    description: "If you have a Companion, you take 1 less damage",
    effects: [setEffect("damageReductionWithCompanion", 1)],
  },
  ...placeholderTalents("companion", "companion-placeholder", 8, 10),
];
