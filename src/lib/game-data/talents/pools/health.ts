import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("health");

export const healthTalents = [
  t(
    "health-threshold-armor",
    "Last Resort",
    "When your Health falls below 25%, cleanse all harmful status effects",
    "HeartCrack",
    setEffect("cleanseBelowHealthPercent", 25),
  ),
  t(
    "health-threshold-block",
    "Desperate Guard",
    "The first time your Health falls below half each combat, gain 6 Block",
    "Shield",
    setEffect("healthThresholdBlockOnce", { threshold: 50, amount: 6 }),
  ),
  t(
    "health-max-4",
    "Will to Live",
    "Death's Door lasts 1 turn longer",
    "Activity",
    setEffect("deathsDoorExtension", 1),
  ),
  t(
    "health-start",
    "Combat Surge",
    "Restore 4 Health at the start of combat",
    "ChevronsUp",
    setEffect("startHealth", 4),
  ),
  t(
    "health-max-per-combat",
    "Vitality",
    "Restore 4 Health after every combat",
    "TrendingUp",
    setEffect("healthRestorePerCombat", 4),
  ),
  t(
    "health-heal-boost",
    "Mending",
    "Health restored is increased by 10%",
    "HeartPulse",
    setEffect("healMultiplier", 1.1),
  ),
  t(
    "health-max-1",
    "Overflow",
    "Gain 25% of excess healing from cards as Block",
    "Container",
    setEffect("overhealToBlockRatio", 0.25),
  ),
  t(
    "health-max-2",
    "Cleansing Status",
    "Cleansing a harmful status effect restores 2 Health",
    "Sparkles",
    setEffect("healOnStatusCleanse", 2),
  ),
  t(
    "health-max-3",
    "Last Gasp",
    "While below half Health, gain 10% Dodge chance",
    "ShieldHalf",
    setEffect("dodgeChanceBelowHalfHealth", 10),
  ),
  t(
    "health-campfire",
    "Clean Slate",
    "When a card restores Health beyond your maximum, cleanse a harmful status effect",
    "Flame",
    setEffect("cleanseOnCardOverheal", true),
  ),
];
