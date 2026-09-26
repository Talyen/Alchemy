import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("leech");

export const leechTalents = [
  t(
    "leech-first-double",
    "Deep Siphon",
    "Leech from your cards restores 10% more Health",
    "Sword",
    setEffect("cardLeechBonusPercent", 10),
  ),
  t(
    "leech-blood-debt",
    "Blood Debt",
    "Leech has a 10% chance to also grant Gold equal to Health restored",
    "CircleDollarSign",
    setEffect("leechGoldChance", 10),
  ),
  t(
    "leech-nature-chance",
    "Affliction Siphon",
    "Leech restores 10% more Health against Poisoned or Bleeding enemies",
    "Utensils",
    setEffect("afflictionLeechBonusPercent", 10),
  ),
  t(
    "leech-desperate",
    "Desperate Siphon",
    "Leech is doubled while you're below half Health",
    "HeartCrack",
    setEffect("leechDesperateMultiplier", 100),
  ),
  t(
    "leech-cull-weak",
    "Cull the Weak",
    "Leech cards deal 25% more damage against enemies below half Health",
    "Skull",
    setEffect("leechCardDamageVsLowHealthPercent", 25),
  ),
  t(
    "leech-block-enemy",
    "Sanguine Overflow",
    "When Leech fills your Health, gain 1 Mana",
    "Hash",
    setEffect("manaOnLeechToFull", 1),
  ),
  t(
    "leech-bleed-chance",
    "Bloodletting",
    "Losing Health has a 10% chance to cleanse a negative status effect",
    "Droplets",
    setEffect("healthLossCleanseChance", 10),
  ),
  t(
    "leech-mana-siphon",
    "Mana Siphon",
    "Leech has a 10% chance to gain 1 Mana",
    "Gem",
    setEffect("manaOnLeechChance", 10),
  ),
  t(
    "leech-trinket-siphon",
    "Armor Siphon",
    "Your Leech cards steal 1 Armor before their effects resolve",
    "Wrench",
    setEffect("armorStealOnLeechCard", 1),
  ),
  t(
    "leech-poison",
    "Virulent Leech",
    "Poison damage has a 10% chance to Leech",
    "FlaskConical",
    setEffect("poisonLeechChance", 10),
  ),
];
