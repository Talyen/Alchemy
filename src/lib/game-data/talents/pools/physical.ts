import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("physical");

export const physicalTalents = [
  t(
    "physical-expert-blacksmith",
    "Expert Blacksmith",
    "Physical damage bonus from Forge is increased by 25%",
    "Anvil",
    setEffect("forgeToPhysicalDamageMultiplier", 1.25),
  ),
  t(
    "physical-shield-bash",
    "Shield Slam",
    "Physical damage is increased by half your Block",
    "Shield",
    setEffect("blockToPhysicalDamageMultiplier", 0.5),
  ),
  t(
    "physical-armored-fists",
    "Armored Fists",
    "Physical damage is increased by half your Armor",
    "HandFist",
    setEffect("armorPhysicalDamagePercent", 50),
  ),
  t(
    "physical-heavy-blows",
    "Heavy Blows",
    "Physical damage has a 10% chance to also Stun",
    "Hammer",
    setEffect("physicalStunChance", 10),
  ),
  t(
    "physical-finish-him",
    "Finish Him",
    "Physical damage is doubled against enemies below 25% Health",
    "Skull",
    setEffect("physicalDoubledBelowQuarterHealth", true),
  ),
  t(
    "physical-shatter",
    "Icebreaker",
    "Physical hits against Frozen enemies grant 1 Forge",
    "Split",
    setEffect("forgeOnPhysicalVsFrozen", 1),
  ),
  t(
    "physical-lacerate",
    "Lacerate",
    "Physical damage has a 10% chance to Bleed",
    "Scissors",
    setEffect("physicalBleedChance", 10),
  ),
  t(
    "physical-hemorrhage",
    "Rupture",
    "Physical critical hits detonate Bleed",
    "Droplets",
    setEffect("physicalDetonatesBleed", true),
  ),
  t(
    "physical-brute-force",
    "Riposte",
    "After you Dodge, your next Physical attack is guaranteed to Critical Hit",
    "Swords",
    setEffect("physicalCritOnDodge", true),
  ),
  t(
    "physical-unrelenting",
    "Unrelenting",
    "Physical damage is doubled while you're below half Health",
    "ShieldCheck",
    setEffect("physicalDoubledBelowHalfHealth", true),
  ),
];
