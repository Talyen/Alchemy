import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("dodge");

export const dodgeTalents = [
  t("dodge-lightfoot", "Lightfoot", "+5% Dodge chance", "Feather", addEffect("dodgeChance", 5)),
  t("dodge-catch-breath", "Catch Breath", "Restore 1 Health when you Dodge", "HeartPulse", addEffect("healOnDodge", 1)),
  t(
    "dodge-feint",
    "Feint",
    "When you Dodge, you have a 25% chance to gain 2 Forge",
    "Anvil",
    addEffect("forgeOnDodge", 2),
  ),
  t("dodge-thornstep", "Thornstep", "Gain 1 Thorns when you Dodge", "Leaf", addEffect("thornsOnDodge", 1)),
  t(
    "dodge-clean-getaway",
    "Clean Getaway",
    "When you Dodge, remove 1 stack each of Burn, Poison, and Bleed from yourself",
    "Eraser",
    addEffect("cleanseStacksOnDodge", 1),
  ),
  t(
    "dodge-open-flank",
    "Open Flank",
    "When you Dodge, your next attack deals 2 additional Physical damage",
    "Swords",
    addEffect("nextAttackPhysicalOnDodge", 2),
  ),
  t(
    "dodge-unburdened",
    "Unburdened",
    "When you Dodge, cleanse your Stun and Freeze buildup",
    "ShieldOff",
    setEffect("cleanseCcOnDodge", true),
  ),
  t("dodge-rolling-recovery", "Tailwind", "When you Dodge, draw a card", "ShieldHalf", setEffect("drawOnDodge", 1)),
  t(
    "dodge-finding-rhythm",
    "Finding Rhythm",
    "Taking damage increases your Dodge chance by 5%, resetting when you Dodge",
    "Activity",
    addEffect("dodgeChanceOnHostileDamage", 5),
  ),
  t(
    "dodge-perfect-timing",
    "Perfect Timing",
    "When you Dodge without Armor, gain 2 Armor",
    "Shield",
    addEffect("armorOnDodge", 2),
  ),
];
