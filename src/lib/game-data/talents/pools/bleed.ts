import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("bleed");

export const bleedTalents = [
  t(
    "bleed-first-free",
    "First Blood",
    "Bleed hits deal 25% more damage against enemies that were not already Bleeding",
    "Swords",
    setEffect("bleedUnwoundedBonusPercent", 25),
  ),
  t(
    "bleed-physical-bonus",
    "Parting Cut",
    "After you Dodge, your next Physical card deals half its damage as Bleed damage",
    "Slash",
    setEffect("partingCutDamagePercent", 50),
  ),
  t(
    "bleed-leech-chance",
    "Sanguine",
    "Bleed damage has a 10% chance to Leech",
    "HeartPulse",
    setEffect("bleedLeechChance", 10),
  ),
  t(
    "bleed-enemy-weak",
    "Mortal Wound",
    "Enemies restore half as much Health while they are Bleeding",
    "Bone",
    setEffect("bleedHalvesEnemyHealing", true),
  ),
  t("bleed-wound-care", "Wound Care", "Take half Bleed damage", "Bandage", setEffect("receiveHalfBleedDamage", true)),
  t(
    "bleed-execute",
    "Flay",
    "Bleed hits have a 20% chance to halve enemy Armor",
    "Scissors",
    setEffect("bleedHalveArmorChance", 20),
  ),
  t(
    "bleed-desperate",
    "Bleeding Out",
    "Deal 25% more Bleed damage while below half Health",
    "HeartCrack",
    setEffect("bleedDesperateMultiplier", 1.25),
  ),
  t(
    "bleed-poison-chance",
    "Tainted Wound",
    "Bleed hits have a 10% chance to deal half their damage as Poison damage",
    "FlaskConical",
    setEffect("bleedPoisonDamageChance", 10),
  ),
  t(
    "bleed-septic-shock",
    "Septic Shock",
    "Bleeding enemies take 10% more Poison damage",
    "TriangleAlert",
    setEffect("bleedPoisonDamageTakenPercent", 10),
  ),
  t(
    "bleed-rip-and-tear",
    "Bloodrush",
    "Dealing Bleed damage has a 10% chance to draw a card",
    "Scissors",
    setEffect("drawOnBleedDamageChance", 10),
  ),
];
