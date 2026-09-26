import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("archery");

export const archeryTalents = [
  t(
    "archery-damage",
    "Arrow Dance",
    "When you Dodge, your next Archery card is free",
    "Move",
    setEffect("nextArcheryCardFreeOnDodge", true),
  ),
  t(
    "archery-hail",
    "Follow-through",
    "Your second Archery card each turn deals 1 additional damage",
    "CloudRain",
    setEffect("archerySecondCardDamage", 1),
  ),
  t(
    "archery-eagle-eye",
    "Eagle Eye",
    "When you play an Archery card against a Stunned enemy, draw a card",
    "Eye",
    setEffect("drawOnArcheryVsStunned", 1),
  ),
  t(
    "archery-hawk-eye",
    "Hawk Eye",
    "Freezing or Stunning an enemy causes your next attack to Critically Hit",
    "ScanEye",
    setEffect("archeryCritOnCrowdControl", true),
  ),
  t(
    "archery-longshot",
    "Longshot",
    "Archery cards deal double damage against enemies at full Health",
    "ArrowRight",
    setEffect("archeryDoubledVsHighHealth", true),
  ),
  t(
    "archery-piercing-shot",
    "Piercing Shot",
    "Archery cards ignore 1 Armor",
    "Aperture",
    addEffect("archeryArmorPiercing", 1),
  ),
  t(
    "archery-quickdraw",
    "Quickdraw",
    "Archery cards deal 1 additional damage if you have no Block",
    "Zap",
    setEffect("archeryDamageWithoutBlock", 1),
  ),
  t(
    "archery-kill-shot",
    "Kill Shot",
    "Archery cards deal double damage against enemies below 20% Health",
    "Crosshair",
    setEffect("archeryDoubledVsLowHealth", true),
  ),
  t(
    "archery-broadhead",
    "Broadhead",
    "Archery hits have a 10% chance to deal a quarter of their damage as Bleed damage",
    "Diamond",
    setEffect("archeryBleedDamageChance", 10),
  ),
  t(
    "archery-trophy-shot",
    "Trophy Shot",
    "Gain 2 Gold when an Archery card defeats an enemy",
    "Award",
    setEffect("goldOnArcheryKill", 2),
  ),
];
