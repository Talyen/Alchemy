import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("companion");

export const companionTalents = [
  t("companion-damage", "Feral Strength", "Increase Companion damage by 1", "Bone", addEffect("companionDamage", 1)),
  t(
    "companion-gold-find",
    "Fetch",
    "Win a combat with a Companion to gain 3 additional Gold",
    "Trash",
    setEffect("companionVictoryGold", 3),
  ),
  t(
    "companion-leech",
    "Leech Companion",
    "Companions have a 10% chance to Leech",
    "HeartPulse",
    setEffect("companionLeechChance", 10),
  ),
  t(
    "companion-hunters-bond",
    "Hunter's Bond",
    "When you play a Companion card, draw a card",
    "Link2",
    setEffect("drawOnCompanionCard", 1),
  ),
  t(
    "companion-predator-instinct",
    "Predator's Instinct",
    "Companions deal double damage against enemies below 30% Health",
    "Eye",
    setEffect("companionDoubledVsLowHealth", true),
  ),
  t(
    "companion-tame",
    "Coordinated Strike",
    "When you play a Physical card, your Companion’s next attack deals 1 additional damage",
    "Hand",
    setEffect("companionNextAttackOnPhysical", 1),
  ),
  t(
    "companion-loyal",
    "Pack Weave",
    "When you Dodge, your Companion has a 50% chance to attack",
    "PawPrint",
    setEffect("companionAttacksOnDodge", true),
  ),
  t(
    "companion-watchdog",
    "Watchdog",
    "When your Block is depleted while you're below half Health, your Companion attacks",
    "ShieldAlert",
    setEffect("companionAttackOnBlockDepletedBelowHalf", true),
  ),
  t(
    "companion-takedown",
    "Takedown",
    "Companion attacks have a 10% chance to deal Stun damage equal to their damage",
    "Ban",
    setEffect("companionStunChance", 10),
  ),
  t(
    "companion-whistle",
    "Whistle",
    "After you play a Companion card, your active Companion acts immediately",
    "Bell",
    setEffect("companionActsOnCard", true),
  ),
];
