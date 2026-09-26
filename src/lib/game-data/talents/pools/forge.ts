import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("forge");

export const forgeTalents = [
  t(
    "forge-to-burn",
    "Ignite",
    "Burn damage is increased by half your Forge",
    "Flame",
    setEffect("forgeBurnDamagePercent", 50),
  ),
  t(
    "forge-to-holy",
    "Sanctify",
    "Holy damage is increased by half your Forge",
    "Sun",
    setEffect("forgeHolyDamagePercent", 50),
  ),
  t(
    "forge-to-block",
    "Tempered Guard",
    "Block gained is increased by half your Forge",
    "Shield",
    setEffect("forgeBlockPercent", 50),
  ),
  t(
    "forge-burn-burst",
    "Overheat",
    "Gain twice as much Forge while you're Burning",
    "Thermometer",
    setEffect("forgeBurningBonusPercent", 100),
  ),
  t("forge-strength-1", "Forge Mastery", "Start each combat with 1 Forge", "FlameKindling", setEffect("startForge", 1)),
  t(
    "forge-strength-2",
    "Rust",
    "Bleed damage is increased by half your Forge",
    "Eraser",
    setEffect("forgeBleedDamagePercent", 50),
  ),
  t(
    "forge-strength-3",
    "Sunder",
    "Physical attacks remove Armor equal to your Forge",
    "ShieldOff",
    setEffect("physicalStripArmorByForge", true),
  ),
  t(
    "forge-strength-4",
    "Intensify",
    "10% chance to double Forge gained",
    "ChevronsUp",
    setEffect("forgeDoubleChance", 10),
  ),
  t(
    "forge-strength-5",
    "Desperate Forge",
    "Gain 25% more Forge while below half Health",
    "HeartCrack",
    setEffect("forgeLowHealthBonusPercent", 25),
  ),
  t(
    "forge-strength-6",
    "Forged Bulwark",
    "Gain 1 Forge when your Block is depleted",
    "Castle",
    setEffect("forgeOnBlockDepleted", 1),
  ),
];
