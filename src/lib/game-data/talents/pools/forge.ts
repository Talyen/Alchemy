import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("forge");

export const forgeTalents = [
  t(
    "forge-to-burn",
    "Ignite",
    "Burn damage is increased by 25% of your Forge",
    "Flame",
    setEffect("forgeBurnDamagePercent", 25),
  ),
  t(
    "forge-to-holy",
    "Sanctify",
    "Holy damage is increased by 25% of your Forge",
    "Sun",
    setEffect("forgeHolyDamagePercent", 25),
  ),
  t(
    "forge-to-block",
    "Tempered Guard",
    "Block gained is increased by 25% of your Forge",
    "Shield",
    setEffect("forgeBlockPercent", 25),
  ),
  t(
    "forge-burn-burst",
    "Overheat",
    "While Burning, gaining Forge has a 25% chance to grant 1 additional Forge",
    "Thermometer",
    setEffect("forgeBurningBonusChance", 25),
  ),
  t("forge-strength-1", "Forge Mastery", "Start each combat with 1 Forge", "FlameKindling", setEffect("startForge", 1)),
  t(
    "forge-strength-2",
    "Rust",
    "Bleed damage is increased by 25% of your Forge",
    "Eraser",
    setEffect("forgeBleedDamagePercent", 25),
  ),
  t(
    "forge-strength-3",
    "Sunder",
    "Physical attacks remove Armor equal to half your Forge",
    "ShieldOff",
    setEffect("physicalStripArmorByForge", true),
  ),
  t(
    "forge-strength-4",
    "Intensify",
    "Gaining Forge has a 10% chance to grant 1 additional Forge",
    "ChevronsUp",
    setEffect("forgeBonusChance", 10),
  ),
  t(
    "forge-strength-5",
    "Desperate Forge",
    "Below half Health, gaining Forge has a 25% chance to grant 1 additional Forge",
    "HeartCrack",
    setEffect("forgeLowHealthBonusChance", 25),
  ),
  t(
    "forge-strength-6",
    "Forged Bulwark",
    "Gain 1 Forge when an enemy attack depletes your Block",
    "Castle",
    setEffect("forgeOnBlockDepleted", 1),
  ),
];
