import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("holy");

export const holyTalents = [
  t(
    "holy-block-scaling",
    "Faith Barrier",
    "Holy damage has a 10% chance to also grant Block",
    "Shield",
    setEffect("holyBlockChance", 10),
  ),
  t(
    "holy-half-damage",
    "Celestial Ward",
    "Take half Holy damage",
    "ShieldCheck",
    setEffect("receiveHalfHolyDamage", true),
  ),
  t(
    "holy-vs-burn",
    "Purge",
    "Holy damage is increased by 10% against Burning enemies",
    "Eraser",
    setEffect("holyVsBurnMultiplier", 10),
  ),
  t(
    "holy-first-free",
    "Divine Favor",
    "When you cleanse a harmful status effect, your next Holy card is free",
    "Gift",
    setEffect("nextHolyFreeOnCleanse", true),
  ),
  t(
    "holy-gold-scaling",
    "Prosperity",
    "Holy damage is increased by 1% of your Gold",
    "TrendingUp",
    setEffect("holyGoldPercent", 1),
  ),
  t(
    "holy-burn-chance",
    "Scorching Light",
    "Holy damage has a 10% chance to also deal Burn damage",
    "Flame",
    setEffect("holyBurnDamageChance", 10),
  ),
  t("holy-tithe", "Tithe", "Holy damage has a 10% chance to also grant Gold", "Cross", setEffect("holyGoldChance", 10)),
  t(
    "holy-block-grant",
    "Radiant Guard",
    "Gaining Block has a 10% chance to draw a Holy card",
    "ShieldPlus",
    setEffect("drawHolyOnBlockChance", 10),
  ),
  t(
    "holy-lifesteal",
    "Blessed Leech",
    "Holy damage gains Leech while you're below half Health",
    "HeartPulse",
    setEffect("holyLifestealPercent", 50),
  ),
  t(
    "holy-wish-chance",
    "Divine Intervention",
    "Holy damage has a 10% chance to Wish",
    "Sparkles",
    setEffect("holyWishChance", 10),
  ),
];
