// Talent definitions for keyword: physical.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const physicalTalents: TalentDefinition[] = [
  {
    id: "physical-expert-blacksmith",
    keywordId: "physical",
    name: "Expert Blacksmith",
    description: "Physical damage bonus from Forge is increased by 50%",
    effects: [setEffect("forgeToPhysicalDamageMultiplier", 1.5)],
  },
  {
    id: "physical-shield-bash",
    keywordId: "physical",
    name: "Shield Bash",
    description: "Physical damage is increased by 30% of your Block",
    effects: [setEffect("blockToPhysicalDamageMultiplier", 0.3)],
  },
  {
    id: "physical-armored-fists",
    keywordId: "physical",
    name: "Armored Fists",
    description: "Physical damage is increased by your Armor",
    effects: [setEffect("armorToPhysicalDamage", true)],
  },
  {
    id: "physical-heavy-blows",
    keywordId: "physical",
    name: "Heavy Blows",
    description: "Physical damage has a 10% chance to Stun",
    effects: [setEffect("physicalStunChance", 10)],
  },
  {
    id: "physical-finish-him",
    keywordId: "physical",
    name: "Finish Him",
    description: "Physical damage is doubled against Stunned enemies",
    effects: [setEffect("physicalDoubledVsStunned", true)],
  },
  {
    id: "physical-shatter",
    keywordId: "physical",
    name: "Shatter",
    description: "Physical damage is doubled against Frozen enemies",
    effects: [setEffect("physicalDoubledVsFrozen", true)],
  },
  {
    id: "physical-lacerate",
    keywordId: "physical",
    name: "Lacerate",
    description: "Physical damage has a 10% chance to Bleed",
    effects: [setEffect("physicalBleedChance", 10)],
  },
  {
    id: "physical-hemorrhage",
    keywordId: "physical",
    name: "Hemorrhage",
    description: "Physical damage detonates Bleed",
    effects: [setEffect("physicalDetonatesBleed", true)],
  },
  {
    id: "physical-brute-force",
    keywordId: "physical",
    name: "Brute Force",
    description: "Increase Physical damage by 1",
    effects: [addEffect("flatPhysicalDamage", 1)],
  },
  {
    id: "physical-unrelenting",
    keywordId: "physical",
    name: "Unrelenting",
    description: "You deal double Physical damage while below 50% Health",
    effects: [setEffect("physicalDoubledBelowHalfHealth", true)],
  },

  // --- Stun ---
];
